import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { encodeGitHubContentsPath } from "@/lib/github-path";
import type { ResumeData, ResumeItem, ResumeProject, ResumeSectionId, Skill } from "@/types";

interface BlogConfig {
  repo: string;
  branch: string;
}

const defaultResume: ResumeData = {
  summary: "",
  experience: [],
  projects: [],
  education: [],
  skills: [],
  sectionOrder: ["summary", "experience", "projects", "skills", "education"],
};

const defaultSectionOrder: ResumeSectionId[] = ["summary", "experience", "projects", "skills", "education"];

function toBase64(content: string): string {
  return Buffer.from(content).toString("base64");
}

function normalizeResume(value: unknown): ResumeData {
  const resume = value && typeof value === "object" ? value as Partial<ResumeData> : {};
  const sectionOrder = Array.isArray(resume.sectionOrder)
    ? [
        ...resume.sectionOrder.filter((section): section is ResumeSectionId => defaultSectionOrder.includes(section as ResumeSectionId)),
        ...defaultSectionOrder.filter((section) => !resume.sectionOrder?.includes(section)),
      ]
    : defaultSectionOrder;
  return {
    summary: typeof resume.summary === "string" ? resume.summary : "",
    experience: Array.isArray(resume.experience) ? resume.experience.map(normalizeResumeItem) : [],
    projects: Array.isArray(resume.projects) ? resume.projects.map(normalizeResumeProject) : [],
    education: Array.isArray(resume.education) ? resume.education.map(normalizeResumeItem) : [],
    skills: Array.isArray(resume.skills) ? resume.skills.map(normalizeSkill) : [],
    sectionOrder,
  };
}

function normalizeResumeItem(value: unknown): ResumeItem {
  const item = value && typeof value === "object" ? value as Partial<ResumeItem> : {};
  return {
    id: typeof item.id === "string" ? item.id : "",
    title: typeof item.title === "string" ? item.title : "",
    subtitle: typeof item.subtitle === "string" ? item.subtitle : "",
    period: typeof item.period === "string" ? item.period : "",
    description: typeof item.description === "string" ? item.description : "",
    location: typeof item.location === "string" ? item.location : "",
    highlights: typeof item.highlights === "string" ? item.highlights : "",
    tags: Array.isArray(item.tags) ? item.tags.filter((tag): tag is string => typeof tag === "string") : [],
  };
}

function normalizeResumeProject(value: unknown): ResumeProject {
  const project = value && typeof value === "object" ? value as Partial<ResumeProject> : {};
  return {
    id: typeof project.id === "string" ? project.id : "",
    sourceType: project.sourceType === "linked" ? "linked" : "custom",
    projectId: typeof project.projectId === "string" ? project.projectId : undefined,
    title: typeof project.title === "string" ? project.title : "",
    role: typeof project.role === "string" ? project.role : "",
    period: typeof project.period === "string" ? project.period : "",
    description: typeof project.description === "string" ? project.description : "",
    highlights: typeof project.highlights === "string" ? project.highlights : "",
    tags: Array.isArray(project.tags) ? project.tags.filter((tag): tag is string => typeof tag === "string") : [],
    link: typeof project.link === "string" ? project.link : "",
    showLink: project.showLink !== false,
  };
}

function normalizeSkill(value: unknown): Skill {
  const skill = value && typeof value === "object" ? value as Partial<Skill> : {};
  return {
    id: typeof skill.id === "string" ? skill.id : "",
    category: typeof skill.category === "string" ? skill.category : "",
    items: Array.isArray(skill.items) ? skill.items.filter((item): item is string => typeof item === "string") : [],
  };
}

async function getConfig() {
  const cookieStore = await cookies();
  let config: BlogConfig | null = null;
  const configCookie = cookieStore.get("voidnap_config");

  if (configCookie) {
    try {
      config = JSON.parse(configCookie.value) as BlogConfig;
    } catch {
      // Invalid cookie, fallback to env var
    }
  }

  if (!config) {
    const publicRepo = process.env.PUBLIC_GITHUB_REPO;
    const publicBranch = process.env.PUBLIC_GITHUB_BRANCH || "main";
    if (publicRepo) {
      config = { repo: publicRepo, branch: publicBranch };
    }
  }

  return { config, cookieStore };
}

export async function GET(): Promise<NextResponse<{ resume?: ResumeData; error?: string }>> {
  const { config } = await getConfig();

  if (!config) {
    return NextResponse.json({ resume: defaultResume });
  }

  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  if (!GITHUB_TOKEN) {
    return NextResponse.json({ resume: defaultResume });
  }

  try {
    const [owner, repoName] = config.repo.split("/");
    const filePath = "data/resume.json";
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/contents/${encodeGitHubContentsPath(filePath)}?ref=${config.branch}`,
      {
        headers: {
          Accept: "application/vnd.github.raw",
          "User-Agent": "HT-CMS",
          Authorization: `Bearer ${GITHUB_TOKEN}`,
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json({ resume: defaultResume });
    }

    const resume = normalizeResume(JSON.parse(await response.text()));
    return NextResponse.json({ resume });
  } catch (error) {
    console.error("Error fetching resume:", error);
    return NextResponse.json({ resume: defaultResume });
  }
}

export async function PUT(request: Request): Promise<NextResponse<{ success?: boolean; error?: string }>> {
  const { config, cookieStore } = await getConfig();
  const sessionCookie = cookieStore.get("voidnap_session");

  if (!sessionCookie) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sessionData = JSON.parse(sessionCookie.value);
    if (sessionData.expiresAt && sessionData.expiresAt < Date.now()) {
      return NextResponse.json({ error: "Session expired" }, { status: 401 });
    }

    if (!config) {
      return NextResponse.json({ error: "Repository not configured" }, { status: 400 });
    }

    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    if (!GITHUB_TOKEN) {
      return NextResponse.json({ error: "GitHub token not configured" }, { status: 500 });
    }

    const body = await request.json();
    const resume = normalizeResume(body.resume);
    const [owner, repoName] = config.repo.split("/");
    const filePath = "data/resume.json";
    const encodedPath = encodeGitHubContentsPath(filePath);
    const githubHeaders = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "HT-CMS",
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      "Content-Type": "application/json",
    } as const;

    const checkResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/contents/${encodedPath}?ref=${config.branch}`,
      { headers: githubHeaders }
    );

    let sha: string | undefined;
    if (checkResponse.ok) {
      const fileData = await checkResponse.json();
      sha = fileData.sha;
    }

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/contents/${encodedPath}`,
      {
        method: "PUT",
        headers: githubHeaders,
        body: JSON.stringify({
          message: sha ? "Update resume" : "Create resume",
          content: toBase64(`${JSON.stringify(resume, null, 2)}\n`),
          sha,
          branch: config.branch,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("GitHub API error:", response.status, errorText);
      return NextResponse.json({ error: "Failed to save resume" }, { status: response.status });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving resume:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
