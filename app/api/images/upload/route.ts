import { NextResponse } from "next/server";
import { cookies } from "next/headers";

interface BlogConfig {
  repo: string;
  branch: string;
}

// Helper to get file extension from MIME type
function getExtension(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/svg+xml": "svg",
  };
  return mimeToExt[mimeType] || "jpg";
}

// Generate unique filename
function generateFilename(originalName: string, mimeType: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const ext = getExtension(mimeType);
  const baseName = originalName
    .replace(/[^a-z0-9]/gi, "-")
    .toLowerCase()
    .substring(0, 50);
  return `${timestamp}-${random}-${baseName}.${ext}`;
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

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const type = formData.get("type") as string || "projects"; // 'projects' or 'blogs'

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "File must be an image" }, { status: 400 });
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File size must be less than 5MB" }, { status: 400 });
    }

    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer();
    const base64Content = Buffer.from(arrayBuffer).toString("base64");

    // Generate filename
    const filename = generateFilename(file.name, file.type);
    const filePath = `images/${type}/${filename}`;

    const [owner, repoName] = config.repo.split("/");

    // Upload to GitHub
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/contents/${filePath}`,
      {
        method: "PUT",
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "HT-CMS",
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: `Upload image: ${filename}`,
          content: base64Content,
          branch: config.branch,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("GitHub API error:", response.status, errorText);
      return NextResponse.json({ error: "Failed to upload image" }, { status: response.status });
    }

    const result = await response.json();

    // Return the raw GitHub URL
    const imageUrl = `https://raw.githubusercontent.com/${owner}/${repoName}/${config.branch}/${filePath}`;

    return NextResponse.json({
      success: true,
      url: imageUrl,
      path: filePath,
    });
  } catch (error) {
    console.error("Error uploading image:", error);
    return NextResponse.json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
