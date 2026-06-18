import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { Project, ResumeData, ResumeProject, Skill, UserProfile } from "@/types";

export const dynamic = "force-dynamic";

interface ResumeGenerateRequest {
  targetRole?: string;
  profile?: UserProfile;
  projects?: Project[];
}

interface AiResumeResponse {
  summary: string;
  projects: Array<Pick<ResumeProject, "projectId" | "title" | "role" | "period" | "description" | "highlights" | "tags" | "link" | "showLink">>;
  skills: Skill[];
}

export async function POST(request: Request): Promise<NextResponse<{ resume?: Partial<ResumeData>; error?: string }>> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("voidnap_session");

  if (!sessionCookie) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ZHIPU_API_KEY not configured" }, { status: 500 });
  }

  try {
    const body = (await request.json()) as ResumeGenerateRequest;
    const targetRole = body.targetRole?.trim() || "软件工程师";
    const profile = body.profile;
    const projects = (body.projects || []).slice(0, 8);

    if (projects.length === 0) {
      return NextResponse.json({ error: "请至少选择一个项目" }, { status: 400 });
    }

    const prompt = buildPrompt(targetRole, profile, projects);
    const response = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.ZHIPU_MODEL || "glm-4-flash",
        messages: [
          {
            role: "system",
            content: "你是资深中文技术简历顾问。只返回合法 JSON，不要 Markdown，不要解释。",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.4,
        max_tokens: 2200,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: `智谱生成失败：${response.status} ${errorText}` }, { status: 500 });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    const parsed = parseJsonObject(content);
    if (!parsed) {
      return NextResponse.json({ error: "智谱返回格式无法解析" }, { status: 500 });
    }

    const aiResume = normalizeAiResume(parsed, projects);
    return NextResponse.json({
      resume: {
        summary: aiResume.summary,
        projects: aiResume.projects,
        skills: aiResume.skills,
      },
    });
  } catch (error) {
    console.error("[AI Resume] Failed to generate resume:", error);
    return NextResponse.json({ error: "生成简历失败" }, { status: 500 });
  }
}

function buildPrompt(targetRole: string, profile: UserProfile | undefined, projects: Project[]) {
  const projectPayload = projects.map((project) => ({
    id: project.id,
    title: project.title,
    description: project.description,
    tags: project.tags,
    link: project.link || project.github || "",
    content: stripMarkdown(project.content).slice(0, 900),
  }));

  return `请根据以下资料，为目标岗位生成一份中文技术简历初稿。

目标岗位：${targetRole}
基础资料：
${JSON.stringify({
  name: profile?.name || "",
  title: profile?.title || "",
  bio: profile?.bio || "",
  github: profile?.socials?.github || "",
}, null, 2)}

候选项目：
${JSON.stringify(projectPayload, null, 2)}

要求：
1. summary 写 80-140 字，面向目标岗位，避免空话。
2. projects 必须基于候选项目，不要编造项目；每个项目生成 description 和 2-4 条 highlights。
3. highlights 强调职责、技术实现、结果或价值；如果资料没有明确数字，不要编造量化结果。
4. skills 从项目 tags 和内容中归纳 2-4 个技能分组，每组 3-8 项。
5. role 可以根据目标岗位填写，如“前端开发 / 全栈开发 / AI 应用开发”；period 没有资料就返回空字符串。
6. 只返回 JSON，结构必须是：
{
  "summary": "string",
  "projects": [
    {
      "projectId": "候选项目 id",
      "title": "string",
      "role": "string",
      "period": "string",
      "description": "string",
      "highlights": ["string"],
      "tags": ["string"],
      "link": "string",
      "showLink": true
    }
  ],
  "skills": [
    { "id": "skill-frontend", "category": "前端开发", "items": ["React"] }
  ]
}`;
}

function stripMarkdown(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[[^\]]+\]\([^)]+\)/g, " ")
    .replace(/[#>*_`~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseJsonObject(value: unknown): AiResumeResponse | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(trimmed) as AiResumeResponse;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(trimmed.slice(start, end + 1)) as AiResumeResponse;
    } catch {
      return null;
    }
  }
}

function normalizeAiResume(value: AiResumeResponse, sourceProjects: Project[]): Pick<ResumeData, "summary" | "projects" | "skills"> {
  const projectMap = new Map(sourceProjects.map((project) => [project.id, project]));
  const projects = (Array.isArray(value.projects) ? value.projects : [])
    .map((project, index): ResumeProject | null => {
      const source = project.projectId ? projectMap.get(project.projectId) : sourceProjects[index];
      if (!source) return null;
      return {
        id: `resume-${source.id}`,
        sourceType: "linked",
        projectId: source.id,
        title: String(project.title || source.title || ""),
        role: String(project.role || ""),
        period: String(project.period || ""),
        description: String(project.description || source.description || ""),
        highlights: normalizeStringList(project.highlights).slice(0, 4),
        tags: normalizeStringList(project.tags).slice(0, 10),
        link: String(project.link || source.link || source.github || ""),
        showLink: project.showLink !== false,
      };
    })
    .filter((project): project is ResumeProject => project !== null);

  const skills = (Array.isArray(value.skills) ? value.skills : [])
    .map((skill, index): Skill => ({
      id: String(skill.id || `skill-${index}`),
      category: String(skill.category || "技能"),
      items: normalizeStringList(skill.items).slice(0, 8),
    }))
    .filter((skill) => skill.items.length > 0);

  return {
    summary: String(value.summary || "").trim(),
    projects,
    skills,
  };
}

function normalizeStringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}
