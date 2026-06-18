import { NextResponse } from "next/server";
import { cookies } from "next/headers";

// Types
interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  updated_at: string;
  created_at: string;
  homepage: string | null;
  html_url: string;
  private: boolean;
  fork: boolean;
  owner: {
    login: string;
    avatar_url: string;
  };
}

// Cache configuration - revalidate every 10 minutes
export const revalidate = 600;
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse<{ repos?: GitHubRepo[]; error?: string }>> {
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

    // Fetch user's repositories
    // type=owner: repos you own
    // sort=updated: most recently updated first
    // per_page=100: maximum per page
    const response = await fetch(
      "https://api.github.com/user/repos?per_page=100&type=owner&sort=updated",
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "HT-CMS",
          Authorization: `Bearer ${GITHUB_TOKEN}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("GitHub API error:", response.status, errorText);
      return NextResponse.json({ error: "Failed to fetch repositories" }, { status: response.status });
    }

    const repos = (await response.json()) as GitHubRepo[];

    // Filter out forks if desired, or keep them
    const filteredRepos = repos.filter(repo => !repo.fork);

    return NextResponse.json({ repos: filteredRepos });
  } catch (error) {
    console.error("Error fetching repositories:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
