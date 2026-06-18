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

interface Blog {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  coverImage: string;
  tags: string[];
  publishedAt: string;
  status: string;
  collection: string | null;
}

interface Frontmatter {
  title?: string;
  excerpt?: string;
  coverImage?: string;
  tags?: string[];
  publishedAt?: string;
  status?: string;
}

// Cache configuration - revalidate every 5 minutes
export const revalidate = 300;
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse<{ blogs?: Blog[]; error?: string }>> {
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
      return NextResponse.json({ blogs: [] });
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

    // Fetch blogs from GitHub repository
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/contents/data/blogs?ref=${config.branch}`,
      githubHeaders
    );

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ blogs: [] });
      }
      return NextResponse.json({ error: "Failed to fetch blogs" }, { status: response.status });
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
      const blogPromises = dirFiles
        .filter((f) => f.name.endsWith(".md") && f.name !== ".collection.md")
        .map((file) => fetchBlogContent(file, dir.name, GITHUB_TOKEN));

      return (await Promise.all(blogPromises)).filter((b): b is Blog => b !== null);
    });

    const collectionsResults = await Promise.all(collectionPromises);
    const blogsFromCollections = collectionsResults.flat();

    // Track blog IDs that are in collections
    const blogIdsInCollections = new Set(
      blogsFromCollections.map((b) => b.id)
    );

    // OPTIMIZATION: Parallel fetch root files that aren't in collections
    const rootFilePromises = rootFiles
      .filter((file) => !blogIdsInCollections.has(file.name.replace(".md", "")))
      .map((file) => fetchBlogContent(file, undefined, GITHUB_TOKEN));

    const blogsFromRoot = (await Promise.all(rootFilePromises)).filter((b): b is Blog => b !== null);

    // Combine and sort by published date
    const allBlogs = [...blogsFromCollections, ...blogsFromRoot];
    allBlogs.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    return NextResponse.json({ blogs: allBlogs });
  } catch (error) {
    console.error("Error fetching blogs:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function fetchBlogContent(
  file: GitHubFile,
  collection?: string,
  token?: string
): Promise<Blog | null> {
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
      excerpt: frontmatter.excerpt || "",
      content: body || content,
      coverImage: frontmatter.coverImage || "",
      tags: frontmatter.tags || [],
      publishedAt: frontmatter.publishedAt || new Date(file.created_at || Date.now()).toISOString(),
      status: frontmatter.status || "published",
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
