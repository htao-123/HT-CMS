import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { encodeGitHubContentsPath } from "@/lib/github-path";

// Types
interface BlogConfig {
  repo: string;
  branch: string;
}

interface ProfileContent {
  name: string;
  title: string;
  bio: string;
  email: string;
  avatarUrl: string;
  socials: {
    github?: string;
    twitter?: string;
    linkedin?: string;
  };
  resume: {
    experience?: Array<Record<string, unknown>>;
    education?: Array<Record<string, unknown>>;
    skills?: string[];
  };
}

interface ProjectContent {
  title: string;
  description: string;
  imageUrl: string;
  tags: string[];
  link?: string;
  github?: string;
  createdAt: string;
  collection?: string | null;
  content?: string;
}

interface BlogContent {
  title: string;
  excerpt: string;
  coverImage: string;
  tags: string[];
  publishedAt: string;
  status: string;
  collection?: string | null;
  content?: string;
}

// Helper function to convert content to base64
function toBase64(content: string): string {
  return Buffer.from(content).toString("base64");
}

// Helper to generate frontmatter
function generateFrontmatter(data: Record<string, boolean | string | unknown[] | null | undefined>): string {
  let frontmatter = "---\n";
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      frontmatter += `${key}: [${value.map((v) => `"${String(v)}"`).join(", ")}]\n`;
    } else if (typeof value === "boolean") {
      frontmatter += `${key}: ${value}\n`;
    } else if (value && value !== "") {
      frontmatter += `${key}: "${value}"\n`;
    }
  }
  frontmatter += "---\n";
  return frontmatter;
}

export async function PUT(request: Request): Promise<NextResponse<{ success?: boolean; content?: unknown; error?: string }>> {
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

    // Get config from cookie or environment variable
    let config: BlogConfig | null = null;
    const configCookie = cookieStore.get("voidnap_config");
    if (configCookie) {
      try {
        config = JSON.parse(configCookie.value) as BlogConfig;
      } catch {
        // Invalid cookie, fallback to env var
      }
    }

    // Fallback to environment variable
    if (!config) {
      const publicRepo = process.env.PUBLIC_GITHUB_REPO;
      const publicBranch = process.env.PUBLIC_GITHUB_BRANCH || "main";
      if (publicRepo) {
        config = { repo: publicRepo, branch: publicBranch };
      } else {
        return NextResponse.json({ error: "Repository not configured" }, { status: 400 });
      }
    }

    const body = await request.json();
    const { type, id, content, oldCollection } = body; // type: 'project' | 'blog' | 'profile'

    if (!type || !id || !content) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    if (!GITHUB_TOKEN) {
      return NextResponse.json({ error: "GitHub token not configured" }, { status: 500 });
    }

    const [owner, repoName] = config.repo.split("/");

    // GitHub API headers
    const githubHeaders = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "HT-CMS",
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      "Content-Type": "application/json",
    } as const;

    // Determine file path based on type and collection
    let filePath: string;
    let fileName: string;

    if (type === "profile") {
      filePath = `data/profile.md`;
      fileName = "profile.md";
    } else if (type === "project") {
      const collection = (content as ProjectContent).collection || null;
      fileName = `${id}.md`;
      filePath = collection ? `data/projects/${collection}/${fileName}` : `data/projects/${fileName}`;
    } else if (type === "blog") {
      const collection = (content as BlogContent).collection || null;
      fileName = `${id}.md`;
      filePath = collection ? `data/blogs/${collection}/${fileName}` : `data/blogs/${fileName}`;
    } else {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    // If collection changed, delete the old file first
    const newCollection = (content as ProjectContent | BlogContent).collection || null;
    if (oldCollection !== newCollection && oldCollection !== undefined && (type === "project" || type === "blog")) {
      const oldFilePath = oldCollection
        ? `data/${type}s/${oldCollection}/${id}.md`
        : `data/${type}s/${id}.md`;

      // Get old file SHA
      const oldFileCheckResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repoName}/contents/${encodeGitHubContentsPath(oldFilePath)}?ref=${config.branch}`,
        {
          headers: githubHeaders,
        }
      );

      // Delete old file if it exists
      if (oldFileCheckResponse.ok) {
        const oldFileData = await oldFileCheckResponse.json();
        const oldSha = oldFileData.sha;

        await fetch(
          `https://api.github.com/repos/${owner}/${repoName}/contents/${encodeGitHubContentsPath(oldFilePath)}`,
          {
            method: "DELETE",
            headers: githubHeaders,
            body: JSON.stringify({
              message: `Move ${type}: ${(content as ProjectContent | BlogContent).title || id} to ${newCollection || "root"}`,
              sha: oldSha,
              branch: config.branch,
            }),
          }
        );
      }
    }

    // Generate markdown content with frontmatter
    let fileContent = "";

    if (type === "profile") {
      const profileContent = content as ProfileContent;
      fileContent = generateFrontmatter({
        name: profileContent.name,
        title: profileContent.title,
        bio: profileContent.bio,
        email: profileContent.email,
        avatarUrl: profileContent.avatarUrl,
        github: profileContent.socials?.github,
        twitter: profileContent.socials?.twitter,
        linkedin: profileContent.socials?.linkedin,
        experience: profileContent.resume?.experience || [],
        education: profileContent.resume?.education || [],
        skills: profileContent.resume?.skills || [],
      });
      fileContent += "\n"; // Empty content section after frontmatter
    } else if (type === "project") {
      const projectContent = content as ProjectContent;
      fileContent = generateFrontmatter({
        title: projectContent.title,
        description: projectContent.description,
        imageUrl: projectContent.imageUrl,
        tags: projectContent.tags || [],
        link: projectContent.link,
        github: projectContent.github,
        createdAt: projectContent.createdAt,
      });
      fileContent += `\n${projectContent.content || ""}`;
    } else if (type === "blog") {
      const blogContent = content as BlogContent;
      fileContent = generateFrontmatter({
        title: blogContent.title,
        excerpt: blogContent.excerpt,
        coverImage: blogContent.coverImage,
        tags: blogContent.tags || [],
        publishedAt: blogContent.publishedAt,
        status: blogContent.status,
      });
      fileContent += `\n${blogContent.content || ""}`;
    }

    // Check if file exists first
    const checkResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/contents/${encodeGitHubContentsPath(filePath)}?ref=${config.branch}`,
      {
        headers: githubHeaders,
      }
    );

    let sha: string | undefined;

    if (checkResponse.ok) {
      const fileData = await checkResponse.json();
      sha = fileData.sha;
    }

    // Create or update file
    const bodyData = sha
      ? {
          message: `Update ${type}: ${(content as ProjectContent | BlogContent).title || id}`,
          content: toBase64(fileContent),
          sha,
          branch: config.branch,
        }
      : {
          message: `Create ${type}: ${(content as ProjectContent | BlogContent).title || id}`,
          content: toBase64(fileContent),
          branch: config.branch,
        };

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/contents/${encodeGitHubContentsPath(filePath)}`,
      {
        method: "PUT",
        headers: githubHeaders,
        body: JSON.stringify(bodyData),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("GitHub API error:", response.status, errorText);
      let errorMsg = "Failed to push to GitHub";
      try {
        const error = JSON.parse(errorText);
        if (error.message) errorMsg = error.message;
      } catch {
        errorMsg = errorText || errorMsg;
      }
      return NextResponse.json({ error: errorMsg }, { status: response.status });
    }

    const result = await response.json();
    return NextResponse.json({ success: true, content: result });
  } catch (error) {
    console.error("Error pushing to GitHub:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE endpoint for removing files
export async function DELETE(request: Request): Promise<NextResponse<{ success?: boolean; error?: string }>> {
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

    // Get config from cookie or environment variable
    let config: BlogConfig | null = null;
    const configCookie = cookieStore.get("voidnap_config");
    if (configCookie) {
      try {
        config = JSON.parse(configCookie.value) as BlogConfig;
      } catch {
        // Invalid cookie, fallback to env var
      }
    }

    // Fallback to environment variable
    if (!config) {
      const publicRepo = process.env.PUBLIC_GITHUB_REPO;
      const publicBranch = process.env.PUBLIC_GITHUB_BRANCH || "main";
      if (publicRepo) {
        config = { repo: publicRepo, branch: publicBranch };
      } else {
        return NextResponse.json({ error: "Repository not configured" }, { status: 400 });
      }
    }
    const body = await request.json();
    const { type, id, collection } = body;

    if (!type || !id) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    if (!GITHUB_TOKEN) {
      return NextResponse.json({ error: "GitHub token not configured" }, { status: 500 });
    }

    const [owner, repoName] = config.repo.split("/");

    // GitHub API headers
    const githubHeaders = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "HT-CMS",
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      "Content-Type": "application/json",
    } as const;

    // Determine file path
    let filePath: string;
    if (type === "project") {
      filePath = collection ? `data/projects/${collection}/${id}.md` : `data/projects/${id}.md`;
    } else if (type === "blog") {
      filePath = collection ? `data/blogs/${collection}/${id}.md` : `data/blogs/${id}.md`;
    } else {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    // Get file SHA first
    const checkResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/contents/${encodeGitHubContentsPath(filePath)}?ref=${config.branch}`,
      {
        headers: githubHeaders,
      }
    );

    if (!checkResponse.ok) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const fileData = await checkResponse.json();
    const sha = fileData.sha;

    // Delete file
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/contents/${encodeGitHubContentsPath(filePath)}`,
      {
        method: "DELETE",
        headers: githubHeaders,
        body: JSON.stringify({
          message: `Delete ${type}: ${id}`,
          sha,
          branch: config.branch,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("GitHub API error:", response.status, errorText);
      return NextResponse.json({ error: "Failed to delete from GitHub" }, { status: response.status });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting from GitHub:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
