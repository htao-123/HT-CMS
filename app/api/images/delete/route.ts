import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { encodeGitHubContentsPath } from "@/lib/github-path";

interface BlogConfig {
  repo: string;
  branch: string;
}

// Helper to extract file path from GitHub raw URL
function extractFilePathFromUrl(imageUrl: string): string | null {
  // Support both raw.githubusercontent.com and jsDelivr CDN URLs
  // raw: https://raw.githubusercontent.com/owner/repo/branch/images/type/filename
  // jsDelivr: https://cdn.jsdelivr.net/gh/owner/repo@branch/images/type/filename

  let match: RegExpMatchArray | null;

  // Try raw.githubusercontent.com format
  match = imageUrl.match(/raw\.githubusercontent\.com\/[^\/]+\/[^\/]+\/[^\/]+\/(.+)/);
  if (match) return match[1];

  // Try jsDelivr CDN format
  match = imageUrl.match(/cdn\.jsdelivr\.net\/gh\/[^\/]+\/[^\/]+@([^\/]+)\/(.+)/);
  if (match) {
    // jsDelivr format: @branch/images/type/filename
    return match[2];
  }

  return null;
}

export async function POST(request: Request) {
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

    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    if (!GITHUB_TOKEN) {
      return NextResponse.json({ error: "GitHub token not configured" }, { status: 500 });
    }

    const body = await request.json();
    const { imageUrl } = body;

    if (!imageUrl) {
      return NextResponse.json({ error: "Image URL is required" }, { status: 400 });
    }

    // Extract file path from URL
    const filePath = extractFilePathFromUrl(imageUrl);
    if (!filePath) {
      return NextResponse.json({ error: "Invalid image URL format" }, { status: 400 });
    }

    // Only allow deleting files from images/ directory
    if (!filePath.startsWith("images/")) {
      return NextResponse.json({ error: "Can only delete files from images/ directory" }, { status: 400 });
    }

    const [owner, repoName] = config.repo.split("/");

    // Get file SHA first
    const checkResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/contents/${encodeGitHubContentsPath(filePath)}?ref=${config.branch}`,
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "HT-CMS",
          Authorization: `Bearer ${GITHUB_TOKEN}`,
        },
      }
    );

    if (!checkResponse.ok) {
      // File doesn't exist, consider it already deleted
      if (checkResponse.status === 404) {
        return NextResponse.json({ success: true });
      }
      return NextResponse.json({ error: "Failed to check file existence" }, { status: checkResponse.status });
    }

    const fileData = await checkResponse.json();
    const sha = fileData.sha;

    // Delete file
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/contents/${encodeGitHubContentsPath(filePath)}`,
      {
        method: "DELETE",
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "HT-CMS",
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: `Delete image: ${filePath}`,
          sha,
          branch: config.branch,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("GitHub API error:", response.status, errorText);
      return NextResponse.json({ error: "Failed to delete image" }, { status: response.status });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting image:", error);
    return NextResponse.json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
