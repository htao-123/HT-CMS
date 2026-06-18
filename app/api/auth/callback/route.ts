import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const expectedState = request.cookies.get("voidnap_oauth_state")?.value;

  if (!code) {
    return NextResponse.redirect(
      new URL("/admin?error=no_code", request.url)
    );
  }

  if (!state || !expectedState || state !== expectedState) {
    const response = NextResponse.redirect(
      new URL("/admin?error=invalid_state", request.url)
    );
    response.cookies.delete("voidnap_oauth_state");
    return response;
  }

  try {
    // Exchange code for access token
    const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || "";
    const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || "";

    // Get the origin from the request headers for dynamic redirect URI
    const origin = request.headers.get("x-forwarded-host")
      ? `${request.headers.get("x-forwarded-proto") || "https"}://${request.headers.get("x-forwarded-host")}`
      : `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}`;

    const redirectUri = `${origin}/api/auth/callback`;

    const tokenResponse = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          client_secret: GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: redirectUri,
        }),
      }
    );

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      console.error("Failed to get access token:", tokenData);
      return NextResponse.redirect(
        new URL("/admin?error=token_failed", request.url)
      );
    }

    // Get user info
    const headers = new Headers();
    headers.append("Authorization", `Bearer ${tokenData.access_token}`);
    headers.append("User-Agent", "HT-CMS");

    const userResponse = await fetch("https://api.github.com/user", {
      headers,
    });

    const userData = await userResponse.json();

    // Create session cookie with user info
    const response = NextResponse.redirect(
      new URL("/admin", request.url)
    );

    // Set secure HTTP-only cookie with session data
    const sessionData = JSON.stringify({
      user: {
        login: userData.login,
        name: userData.name,
        avatar: userData.avatar_url,
      },
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    response.cookies.set("voidnap_session", sessionData, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
    });
    response.cookies.delete("voidnap_oauth_state");

    return response;
  } catch (error) {
    console.error("GitHub OAuth error:", error);
    const response = NextResponse.redirect(
      new URL("/admin?error=oauth_failed", request.url)
    );
    response.cookies.delete("voidnap_oauth_state");
    return response;
  }
}
