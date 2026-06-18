import { NextResponse } from "next/server";
import { cookies } from "next/headers";

// Types
interface GitHubFile {
  name: string;
  type: "file" | "dir";
  url: string;
  created_at?: string;
}

interface BlogConfig {
  repo: string;
  branch: string;
}

interface Project {
  id: string;
  title: string;
  description: string;
  content: string;
  imageUrl: string;
  tags: string[];
  link?: string;
  github?: string;
  createdAt: string;
  collection: string | null;
}

interface Frontmatter {
  title?: string;
  description?: string;
  imageUrl?: string;
  tags?: string[];
  link?: string;
  github?: string;
  createdAt?: string;
}

// Cache configuration - revalidate every 5 minutes
export const revalidate = 300;
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse<{ projects?: Project[]; error?: string }>> {
  const cookieStore = await cookies();
  const configCookie = cookieStore.get("voidnap_config");

  // Get config from cookie or environment variable
  let config: BlogConfig | null = null;
  if (configCookie) {
    try {
      config = JSON.parse(configCookie.value) as BlogConfig;
    } catch {
      // Invalid cookie, fallback to env var
    }
  }

  // Fallback to environment variable for public access
  if (!config) {
    const publicRepo = process.env.PUBLIC_GITHUB_REPO;
    const publicBranch = process.env.PUBLIC_GITHUB_BRANCH || "main";
    if (publicRepo) {
      config = { repo: publicRepo, branch: publicBranch };
    } else {
      return NextResponse.json({ projects: [] });
    }
  }

  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  if (!GITHUB_TOKEN) {
    return NextResponse.json({ error: "GitHub token not configured" }, { status: 500 });
  }

  try {
    const [owner, repoName] = config.repo.split("/");

    // Create headers for GitHub API requests
    const githubHeaders = {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "HT-CMS",
        Authorization: `Bearer ${GITHUB_TOKEN}`,
      } as const,
    };

    // Fetch projects from GitHub repository
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/contents/data/projects?ref=${config.branch}`,
      githubHeaders
    );

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ projects: [] });
      }
      return NextResponse.json({ error: "Failed to fetch projects" }, { status: response.status });
    }

    const files = (await response.json()) as GitHubFile[];

    // Separate directories and files
    const directories = files.filter((f) => f.type === "dir");
    const rootFiles = files.filter((f) => f.name.endsWith(".md"));

    // OPTIMIZATION: Parallel fetch all directory contents
    const collectionPromises = directories.map(async (dir) => {
      const dirResponse = await fetch(dir.url, githubHeaders);
      if (!dirResponse.ok) return [];

      const dirFiles = (await dirResponse.json()) as GitHubFile[];
      const projectPromises = dirFiles
        .filter((f) => f.name.endsWith(".md") && f.name !== ".collection.md")
        .map((file) => fetchProjectContent(file, dir.name, GITHUB_TOKEN));

      return (await Promise.all(projectPromises)).filter((p): p is Project => p !== null);
    });

    const collectionsResults = await Promise.all(collectionPromises);
    const projectsFromCollections = collectionsResults.flat();

    // Track project IDs that are in collections
    const projectIdsInCollections = new Set(projectsFromCollections.map((p) => p.id));

    // OPTIMIZATION: Parallel fetch root files that aren't in collections
    const rootFilePromises = rootFiles
      .filter((file) => !projectIdsInCollections.has(file.name.replace(".md", "")))
      .map((file) => fetchProjectContent(file, undefined, GITHUB_TOKEN));

    const projectsFromRoot = (await Promise.all(rootFilePromises)).filter((p): p is Project => p !== null);

    // Combine all projects
    const allProjects = [...projectsFromCollections, ...projectsFromRoot];

    return NextResponse.json({ projects: allProjects });
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function fetchProjectContent(
  file: GitHubFile,
  collection?: string,
  token?: string
): Promise<Project | null> {
  try {
    const GITHUB_TOKEN = token || process.env.GITHUB_TOKEN;
    if (!GITHUB_TOKEN) return null;

    const contentResponse = await fetch(file.url, {
      headers: {
        Accept: "application/vnd.github.raw",
        "User-Agent": "HT-CMS",
        Authorization: `Bearer ${GITHUB_TOKEN}`,
      },
    });

    if (!contentResponse.ok) return null;

    const content = await contentResponse.text();
    const { frontmatter, body } = parseFrontmatter(content);

    return {
      id: file.name.replace(".md", ""),
      title: frontmatter.title || file.name.replace(".md", ""),
      description: frontmatter.description || "",
      content: body || content,
      imageUrl: frontmatter.imageUrl || "",
      tags: frontmatter.tags || [],
      link: frontmatter.link,
      github: frontmatter.github,
      createdAt: frontmatter.createdAt || new Date(file.created_at || Date.now()).toISOString(),
      collection: collection || null,
    };
  } catch {
    return null;
  }
}

function parseFrontmatter(content: string): { frontmatter: Frontmatter; body: string } {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const frontmatter: Frontmatter = {};
  const lines = match[1].split("\n");

  for (const line of lines) {
    const colonIndex = line.indexOf(":");
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim() as keyof Frontmatter;
      let value: string | string[] | boolean = line.slice(colonIndex + 1).trim();

      // Strip quotes from string values
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      // Parse arrays
      if (value.startsWith("[") && value.endsWith("]")) {
        value = value
          .slice(1, -1)
          .split(",")
          .map((v) => v.trim().replace(/"/g, ""))
          .filter(Boolean);
      } else if (value === "true") {
        value = true;
      } else if (value === "false") {
        value = false;
      }

      frontmatter[key] = value as never;
    }
  }

  return { frontmatter, body: match[2] };
}
