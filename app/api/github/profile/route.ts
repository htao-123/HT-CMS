import { NextResponse } from "next/server";
import { cookies } from "next/headers";

// Types
interface BlogConfig {
  repo: string;
  branch: string;
}

interface Profile {
  name: string;
  title: string;
  bio: string;
  email: string;
  avatarUrl: string;
  socials: {
    github: string;
    twitter: string;
    linkedin: string;
  };
  resume: {
    experience: Array<{ role?: string; company?: string; description?: string; from?: string; to?: string }>;
    education: Array<{ school?: string; degree?: string; field?: string; from?: string; to?: string }>;
    skills: string[];
  };
}

interface ProfileFrontmatter {
  name?: string;
  title?: string;
  bio?: string;
  email?: string;
  avatarUrl?: string;
  github?: string;
  twitter?: string;
  linkedin?: string;
  experience?: ProfileFrontmatter[];
  education?: ProfileFrontmatter[];
  skills?: string[];
}

// Cache configuration - revalidate every 5 minutes
export const revalidate = 300;
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse<{ profile?: Profile | null; error?: string }>> {
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
      return NextResponse.json({ profile: null });
    }
  }

  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  if (!GITHUB_TOKEN) {
    return NextResponse.json({ profile: null });
  }

  try {
    const [owner, repoName] = config.repo.split("/");

    // Fetch profile from GitHub repository
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/contents/data/profile.md?ref=${config.branch}`,
      {
        headers: {
          Accept: "application/vnd.github.raw",
          "User-Agent": "HT-CMS",
          Authorization: `Bearer ${GITHUB_TOKEN}`,
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json({ profile: null });
    }

    const content = await response.text();
    const frontmatter = parseFrontmatter(content);

    const profile: Profile = {
      name: frontmatter.name || "User",
      title: frontmatter.title || "",
      bio: frontmatter.bio || "",
      email: frontmatter.email || "",
      avatarUrl: frontmatter.avatarUrl || "",
      socials: {
        github: frontmatter.github || "",
        twitter: frontmatter.twitter || "",
        linkedin: frontmatter.linkedin || "",
      },
      resume: {
        experience: (frontmatter.experience as any) || [],
        education: (frontmatter.education as any) || [],
        skills: frontmatter.skills || [],
      },
    };

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("Error fetching profile:", error);
    return NextResponse.json({ profile: null });
  }
}

function parseFrontmatter(content: string): ProfileFrontmatter {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return {};
  }

  const frontmatter: ProfileFrontmatter = {};
  const lines = match[1].split("\n");

  for (const line of lines) {
    const colonIndex = line.indexOf(":");
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      let value: any = line.slice(colonIndex + 1).trim();

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
          .map((v: string) => v.trim().replace(/"/g, ""))
          .filter(Boolean);
      } else if (value === "true") {
        value = true;
      } else if (value === "false") {
        value = false;
      }

      (frontmatter as any)[key] = value;
    }
  }

  return frontmatter;
}
