import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ owner: string; repo: string }> }
) {
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

    const { owner, repo } = await params;

    // Check if repository exists using GitHub API
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "HT-CMS",
    };

    // Add GitHub token if available (for private repos)
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    if (GITHUB_TOKEN) {
      headers["Authorization"] = `Bearer ${GITHUB_TOKEN}`;
    }

    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers,
    });

    if (!response.ok) {
      console.error(`GitHub API error checking repo ${owner}/${repo}:`, response.status, response.statusText);
      if (response.status === 404) {
        return NextResponse.json({ exists: false });
      }
      return NextResponse.json({ error: "Failed to check repository" }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json({ exists: true, repo: data });
  } catch (error) {
    console.error("Error checking repo:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
