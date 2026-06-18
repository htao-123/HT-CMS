import { NextResponse } from "next/server";
import { cookies } from "next/headers";

// Types
interface Project {
  id: string;
  title: string;
  description: string;
  content: string;
  imageUrl: string;
  tags: string[];
  link?: string;
  github: string;
  createdAt: string;
  collection?: string | null;
}

interface GitHubRepoInfo {
  name: string;
  description: string | null;
  homepage: string | null;
  language: string | null;
  created_at: string;
  html_url: string;
  topics: string[];
}

interface GitHubLanguage {
  [key: string]: number;
}

// Cache configuration - revalidate every 10 minutes
export const revalidate = 600;
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ owner: string; repo: string }> }
): Promise<NextResponse<{ project?: Project; error?: string }>> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("voidnap_session");

  if (!sessionCookie) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sessionData = JSON.parse(sessionCookie.value);
    if (sessionData.expiresAt && sessionData.expiresAt < Date.now()) {
      return NextResponse.json({ error: "Session expired" }, { status: 401 });
    }

    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    if (!GITHUB_TOKEN) {
      return NextResponse.json({ error: "GitHub token not configured" }, { status: 500 });
    }

    const { owner, repo } = await params;

    // Check if AI is configured for description generation
    const hasAIKey = !!process.env.ZHIPU_API_KEY;

    // GitHub API headers
    const githubHeaders = {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "HT-CMS",
        Authorization: `Bearer ${GITHUB_TOKEN}`,
      } as const,
    };

    // Parallel fetch all repository information
    const [
      repoInfoResponse,
      readmeResponse,
      languagesResponse,
    ] = await Promise.all([
      fetch(`https://api.github.com/repos/${owner}/${repo}`, githubHeaders),
      fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, githubHeaders),
      fetch(`https://api.github.com/repos/${owner}/${repo}/languages`, githubHeaders),
    ]);

    // Parse repository info
    const repoInfo: GitHubRepoInfo | null = repoInfoResponse.ok
      ? await repoInfoResponse.json()
      : null;

    if (!repoInfo) {
      return NextResponse.json({ error: "Repository not found" }, { status: 404 });
    }

    // Get README content
    let readmeContent = "";
    if (readmeResponse.ok) {
      const readmeData = await readmeResponse.json();
      readmeContent = Buffer.from(readmeData.content, 'base64').toString('utf-8');
    }

    // Get languages
    let languages: string[] = [];
    if (languagesResponse.ok) {
      const langData: GitHubLanguage = await languagesResponse.json();
      languages = Object.keys(langData);
    }

    // Use AI to generate description if configured
    let description = repoInfo.description || "";
    if (hasAIKey && (!description || description.trim().length === 0)) {
      try {
        const prompt = `请基于以下 GitHub 仓库信息，生成一个简短的项目简介（1-2句话，50字以内）：

仓库名称：${repoInfo.name}
仓库描述：${repoInfo.description || "无"}
编程语言：${languages.join(", ") || "未知"}
Topics：${repoInfo.topics.join(", ") || "无"}
${readmeContent ? `README 前200字：\n${readmeContent.slice(0, 200)}` : ""}

请直接返回简介文本，不要有其他内容。`;

        const aiResponse = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.ZHIPU_API_KEY}`,
          },
          body: JSON.stringify({
            model: process.env.ZHIPU_MODEL || "glm-4-flash",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 100,
          }),
        });

        if (aiResponse.ok) {
          const data = await aiResponse.json();
          const aiDescription = data.choices?.[0]?.message?.content?.trim();
          if (aiDescription) {
            description = aiDescription;
            console.log("[AI] Generated description for", repoInfo.name);
          }
        }
      } catch (error) {
        console.error("[AI] Failed to generate description:", error);
        // Fall back to original description
      }
    }

    // Create project from repo data
    const project: Project = {
      id: `project-${Date.now()}`,
      title: repoInfo.name,
      description,
      content: readmeContent,
      imageUrl: "",
      tags: Array.from(new Set([...languages, ...repoInfo.topics])),
      link: repoInfo.homepage || undefined,
      github: repoInfo.html_url,
      createdAt: repoInfo.created_at,
      collection: null,
    };

    return NextResponse.json({ project });
  } catch (error) {
    console.error("Error fetching repository details:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
