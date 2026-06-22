import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { buildSkillGroupsFromProjects, ensureMarkdownList, mergeSkillGroups } from "@/lib/resume-skills";
import type { Project, ResumeData, ResumeProject, Skill, UserProfile } from "@/types";

export const dynamic = "force-dynamic";

interface ResumeGenerateRequest {
  mode?: "generate";
  targetRole?: string;
  profile?: UserProfile;
  projects?: Project[];
}

interface ResumePolishRequest {
  mode: "polish";
  text?: string;
  label?: string;
  context?: string;
}

interface AiResumeResponse {
  summary: string;
  projects: Array<Pick<ResumeProject, "projectId" | "title" | "role" | "period" | "description" | "highlights" | "tags" | "link" | "showLink">>;
  skills: AiSkillResponse[];
}

interface AiSkillResponse {
  id?: string;
  category?: string;
  content?: string;
  items?: unknown;
}

export async function POST(request: Request): Promise<NextResponse<{ resume?: Partial<ResumeData>; text?: string; error?: string }>> {
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
    const body = (await request.json()) as ResumeGenerateRequest | ResumePolishRequest;

    if (body.mode === "polish") {
      const originalText = body.text?.trim();
      if (!originalText) {
        return NextResponse.json({ error: "请先填写需要润色的内容" }, { status: 400 });
      }

      const response = await requestZhipu(apiKey, [
        {
          role: "system",
          content: "你是资深中文技术简历顾问，只负责润色用户给定的简历字段。必须保留事实，不编造公司、学历、时间、数字、技术栈或成果。只返回合法 JSON，不要解释。",
        },
        { role: "user", content: buildPolishPrompt(originalText, body.label, body.context) },
      ], 1000);

      if (!response.ok) {
        const errorText = await response.text();
        return NextResponse.json({ error: `智谱润色失败：${response.status} ${errorText}` }, { status: 500 });
      }

      const data = await response.json();
      const parsed = parseJsonObject<{ text?: string }>(data.choices?.[0]?.message?.content);
      const polished = parsed?.text?.trim();
      if (!polished) {
        return NextResponse.json({ error: "智谱返回格式无法解析" }, { status: 500 });
      }

      return NextResponse.json({ text: polished });
    }

    const targetRole = body.targetRole?.trim() || "软件工程师";
    const profile = body.profile;
    const projects = body.projects || [];

    if (projects.length === 0) {
      return NextResponse.json({ error: "请至少选择一个项目" }, { status: 400 });
    }

    const prompt = buildPrompt(targetRole, profile, projects);
    const response = await requestZhipu(apiKey, [
      {
        role: "system",
        content: "你是资深中文技术简历顾问，擅长把个人项目改写成能投递的技术简历。只返回合法 JSON，不要解释。",
      },
      { role: "user", content: prompt },
    ], 3600);

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: `智谱生成失败：${response.status} ${errorText}` }, { status: 500 });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    const parsed = parseJsonObject<AiResumeResponse>(content);
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

function requestZhipu(apiKey: string, messages: Array<{ role: "system" | "user"; content: string }>, maxTokens: number) {
  return fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.ZHIPU_MODEL || "glm-4-flash",
      messages,
      temperature: 0.25,
      max_tokens: maxTokens,
    }),
  });
}

function buildPolishPrompt(text: string, label = "简历字段", context = "") {
  return `请润色下面这个“${label}”，让它更像中文技术简历里的表达。

已填上下文：
${context || "无"}

原文：
${text}

要求：
1. 只优化表达、结构和动作词，不新增事实。
2. 不要编造数字、公司、职位、学历、时间、成果、技术栈。
3. 如果原文是亮点列表，返回时使用 Markdown 列表，不要合并成段落。
4. 语言要具体、克制、可投递，避免“热爱学习、积极主动、熟悉各种技术”等空话。
5. 保留原本的人称省略风格，不要写“我”。
6. 如果原文已有 Markdown，请保留格式；可以少量使用 **加粗** 强调关键词，但不要使用标题、表格、图片或代码块。
7. 只返回 JSON：{"text":"润色后的文本"}`;
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

已有项目素材：
${JSON.stringify(projectPayload, null, 2)}

要求：
1. 这是一份“求职简历”，不是项目介绍页。语言要像候选人的工作成果，避免“这是一个……项目”这种介绍腔。
2. summary 写 90-150 字，结构为：目标岗位匹配度 + 核心技术栈 + 能独立完成的事情 + 代表项目。不要写“热爱学习”“积极主动”等空话。
3. projects 必须基于已有项目素材，不要编造项目；项目较多时优先选择 3-5 个最能体现目标岗位能力的项目。description 写 35-70 字，说明项目定位、技术复杂度和个人负责范围。
4. 每个项目 highlights 返回一个 Markdown 文本块，包含 3-4 条以 "- " 开头的列表，每条 25-55 字，用“负责/设计/实现/封装/优化/接入/构建/沉淀”等动作开头，体现技术实现、工程化、跨端/数据/性能/部署/体验价值。
5. 如果没有明确数据，不要编造百分比、用户量、耗时缩短等量化结果；可以写“提升维护性”“降低重复配置”“完善异常处理”等非虚构价值。
6. skills 按主流技术简历写法归纳为 3-5 个技能类别；类别名短而具体，如“前端框架与语言”“跨端与客户端”“后端与接口”“工程化与部署”“AI 与数据”。每个技能分组只能返回 content 字段，content 必须是 Markdown 列表，包含 1-3 条以 "- " 开头的内容；不要返回单行关键词，不要返回 items 字段。只写能从项目素材中支撑的内容，不写“精通/熟练/了解”、百分比、评分或进度条。
7. role 根据目标岗位和项目内容填写，如“跨端应用开发”“前端开发”“全栈开发”“AI 应用开发”；period 没有资料就返回空字符串。
8. 不要输出空项目、空技能；不要把 README 原文直接复制到 highlights。
9. summary、description、highlights 可以少量使用 Markdown 的 **加粗** 或链接；不要使用标题、表格、图片或代码块。
10. 只返回 JSON，结构必须是：
{
  "summary": "string",
  "projects": [
    {
      "projectId": "候选项目 id",
      "title": "string",
      "role": "string",
      "period": "string",
      "description": "string",
      "highlights": "- string\\n- string",
      "tags": ["string"],
      "link": "string",
      "showLink": true
    }
  ],
  "skills": [
    { "id": "skill-frontend", "category": "前端开发", "content": "- React、Next.js、TypeScript\\n- 组件化页面开发、路由组织与前端状态维护" }
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

function parseJsonObject<T>(value: unknown): T | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(trimmed.slice(start, end + 1)) as T;
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
        highlights: String(project.highlights || ""),
        tags: normalizeStringList(project.tags).slice(0, 10),
        link: String(project.link || source.link || source.github || ""),
        showLink: project.showLink !== false,
      };
    })
    .filter((project): project is ResumeProject => project !== null);

  const aiSkills = (Array.isArray(value.skills) ? value.skills : [])
    .map((skill, index): Skill => ({
      id: String(skill.id || `skill-${index}`),
      category: String(skill.category || "技能"),
      content: normalizeSkillContent(skill),
    }))
    .filter((skill) => skill.content.length > 0);
  const skills = mergeSkillGroups(aiSkills, buildSkillGroupsFromProjects(sourceProjects));

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

function normalizeSkillContent(skill: AiSkillResponse) {
  const content = typeof skill.content === "string" ? skill.content.trim() : "";
  if (content) return ensureMarkdownList(content);
  const items = normalizeStringList(skill.items);
  return items.length ? `- ${items.join("、")}` : "";
}
