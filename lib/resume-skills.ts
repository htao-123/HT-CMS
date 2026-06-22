import type { Project, Skill } from "@/types";

const skillGroups = [
  {
    id: "skill-client",
    category: "跨端与客户端",
    keywords: ["Dart", "Flutter", "Kotlin", "Swift", "Objective-C", "C++", "CMake"],
    patterns: [/flutter/i, /\bdart\b/i, /kotlin/i, /swift/i, /objective-c/i, /\bc\+\+\b/i, /cmake/i, /跨端|安卓|android|ios|客户端/i],
  },
  {
    id: "skill-frontend",
    category: "前端框架与语言",
    keywords: ["React", "Next.js", "TypeScript", "JavaScript", "Vue", "Tailwind CSS"],
    patterns: [/react/i, /next\.?js/i, /typescript/i, /javascript/i, /\bvue\b/i, /tailwind/i, /前端|组件|页面|路由/i],
  },
  {
    id: "skill-backend",
    category: "后端与接口",
    keywords: ["Node.js", "FastAPI", "Python", "Express", "REST API", "OAuth", "GitHub API"],
    patterns: [/node\.?js/i, /fastapi/i, /python/i, /express/i, /api|接口|服务端|后端/i, /oauth/i, /github api|github contents/i],
  },
  {
    id: "skill-engineering",
    category: "工程化与部署",
    keywords: ["Cloudflare Workers", "EdgeOne", "GitHub Actions", "Docker", "Vercel", "CI/CD"],
    patterns: [/cloudflare|workers/i, /edgeone|腾讯云/i, /github actions/i, /docker/i, /vercel/i, /ci\/?cd|部署|构建|自动化/i],
  },
  {
    id: "skill-ai-data",
    category: "AI 与数据",
    keywords: ["智谱 AI", "LLM", "Prompt", "Markdown", "JSON", "数据归一化"],
    patterns: [/智谱|zhipu|glm/i, /\bai\b|llm|大模型|模型/i, /prompt|提示词/i, /markdown/i, /json/i, /数据|归一化/i],
  },
];

export function buildSkillGroupsFromProjects(projects: Project[]): Skill[] {
  const projectText = projects.map((project) => [
    project.title,
    project.description,
    project.content,
    ...(project.tags || []),
  ].join("\n")).join("\n");
  const normalizedTags = uniq(projects.flatMap((project) => project.tags || []).map(normalizeTechName));

  const groups = skillGroups
    .map((group) => {
      const matchedTags = normalizedTags.filter((tag) => group.keywords.includes(tag));
      const inferredTags = group.patterns.some((pattern) => pattern.test(projectText)) ? group.keywords : [];
      const tags = uniq([...matchedTags, ...inferredTags]).slice(0, 8);
      return {
        id: group.id,
        category: group.category,
        content: formatSkillContent(tags),
      };
    })
    .filter((group) => group.content.length > 0);

  const used = new Set(groups.flatMap((group) => parseSkillContent(group.content)));
  const others = normalizedTags.filter((tag) => !used.has(tag)).slice(0, 8);
  if (others.length > 0) {
    groups.push({ id: "skill-other", category: "其他关键词", content: formatSkillContent(others) });
  }

  return groups;
}

export function mergeSkillGroups(primary: Skill[], fallback: Skill[]) {
  const merged = [...primary.filter((skill) => skill.category.trim() && skill.content.trim())];
  const existingKeys = new Set(merged.map((skill) => getSkillCategoryKey(skill.category)));

  for (const skill of fallback) {
    const key = getSkillCategoryKey(skill.category);
    if (!existingKeys.has(key) && skill.content.trim()) {
      merged.push(skill);
      existingKeys.add(key);
    }
  }

  return merged;
}

export function ensureMarkdownList(content: string) {
  const trimmed = content.trim();
  if (!trimmed) return "";
  if (/^\s*[-*]\s+/m.test(trimmed)) return trimmed;
  return `- ${trimmed}`;
}

function formatSkillContent(tags: string[]) {
  if (!tags.length) return "";
  return `- ${tags.join("、")}`;
}

function parseSkillContent(content: string) {
  return content
    .replace(/^\s*[-*]\s+/gm, "")
    .split(/[、,，/；;\n]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function getSkillCategoryKey(category: string) {
  if (/前端|frontend/i.test(category)) return "frontend";
  if (/跨端|客户端|移动|mobile|client/i.test(category)) return "client";
  if (/后端|接口|服务|backend|api/i.test(category)) return "backend";
  if (/工程|部署|构建|devops|ci|cd/i.test(category)) return "engineering";
  if (/ai|智能|模型|数据|llm/i.test(category)) return "ai-data";
  return category.trim().toLowerCase();
}

function normalizeTechName(value: string) {
  const aliases: Record<string, string> = {
    dart: "Dart",
    flutter: "Flutter",
    kotlin: "Kotlin",
    swift: "Swift",
    rust: "Rust",
    python: "Python",
    react: "React",
    nextjs: "Next.js",
    "next.js": "Next.js",
    typescript: "TypeScript",
    javascript: "JavaScript",
    fastapi: "FastAPI",
    node: "Node.js",
    "node.js": "Node.js",
    tailwind: "Tailwind CSS",
    "tailwind css": "Tailwind CSS",
    cloudflare: "Cloudflare Workers",
    workers: "Cloudflare Workers",
    edgeone: "EdgeOne",
    docker: "Docker",
    oauth: "OAuth",
    markdown: "Markdown",
    json: "JSON",
    zhipu: "智谱 AI",
    glm: "智谱 AI",
  };
  return aliases[value.toLowerCase()] || value;
}

function uniq(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}
