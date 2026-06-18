import { NextResponse } from "next/server";
import { cookies } from "next/headers";

// Store user's access token in session after GitHub OAuth
// For now, we'll need to modify the callback to store the access token

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("voidnap_session");

  if (!sessionCookie) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, description, isPrivate } = body;

    if (!name) {
      return NextResponse.json({ error: "Repository name is required" }, { status: 400 });
    }

    // Get user's access token from environment (in production, get from session)
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

    if (!GITHUB_TOKEN) {
      return NextResponse.json({ error: "GitHub token not configured" }, { status: 500 });
    }

    // Create repository using GitHub API
    const response = await fetch("https://api.github.com/user/repos", {
      method: "POST",
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "HT-CMS",
        Authorization: `Bearer ${GITHUB_TOKEN}`,
      },
      body: JSON.stringify({
        name,
        description: description || "Personal website content - Managed by CMS",
        private: isPrivate || false,
        auto_init: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("GitHub API error:", response.status, errorText);
      let errorMsg = "Failed to create repository";
      try {
        const error = JSON.parse(errorText);
        if (error.message) errorMsg = error.message;
        if (Array.isArray(error.errors)) {
          errorMsg = error.errors
            .map((e: { message?: string }) => e.message)
            .filter(Boolean)
            .join(", ");
        }
      } catch {
        errorMsg = errorText || errorMsg;
      }
      return NextResponse.json({ error: errorMsg }, { status: response.status });
    }

    const repo = await response.json();
    const config = {
      repo: repo.full_name,
      branch: repo.default_branch || "main",
    };

    // Store config
    const resp = NextResponse.json({ config, success: true });
    resp.cookies.set("voidnap_config", JSON.stringify(config), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return resp;
  } catch (error) {
    console.error("Error creating repo:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
