import type { Project, Skill } from "@/types";

interface SkillKeyword {
  name: string;
  aliases?: string[];
  patterns: RegExp[];
  hints: string[];
}

const skillKeywords: SkillKeyword[] = [
  { name: "React", patterns: [/react/i], hints: ["前端", "组件", "页面", "frontend"] },
  { name: "Next.js", aliases: ["nextjs", "next.js"], patterns: [/next\.?js/i], hints: ["前端", "全栈", "服务端渲染", "frontend"] },
  { name: "TypeScript", aliases: ["typescript", "ts"], patterns: [/typescript|\bts\b/i], hints: ["前端", "工程", "语言", "frontend"] },
  { name: "JavaScript", aliases: ["javascript", "js"], patterns: [/javascript|\bjs\b/i], hints: ["前端", "语言", "frontend"] },
  { name: "Tailwind CSS", aliases: ["tailwind", "tailwind css"], patterns: [/tailwind/i], hints: ["前端", "样式", "ui", "frontend"] },
  { name: "Flutter", patterns: [/flutter/i], hints: ["跨端", "客户端", "移动端", "mobile"] },
  { name: "Dart", patterns: [/\bdart\b/i], hints: ["跨端", "客户端", "移动端", "mobile"] },
  { name: "Kotlin", patterns: [/kotlin/i], hints: ["安卓", "客户端", "移动端", "mobile"] },
  { name: "Swift", patterns: [/swift/i], hints: ["iOS", "客户端", "移动端", "mobile"] },
  { name: "Node.js", aliases: ["node", "node.js"], patterns: [/node\.?js/i], hints: ["后端", "接口", "服务", "backend", "api"] },
  { name: "FastAPI", aliases: ["fastapi"], patterns: [/fastapi/i], hints: ["后端", "接口", "服务", "backend", "api"] },
  { name: "Python", patterns: [/python/i], hints: ["后端", "脚本", "数据", "backend"] },
  { name: "REST API", aliases: ["api", "rest"], patterns: [/rest api|\bapi\b|接口/i], hints: ["后端", "接口", "集成", "backend", "api"] },
  { name: "OAuth", aliases: ["oauth"], patterns: [/oauth/i], hints: ["认证", "登录", "接口", "安全", "api"] },
  { name: "GitHub API", aliases: ["github api"], patterns: [/github api|github contents/i], hints: ["接口", "集成", "github", "api"] },
  { name: "Cloudflare Workers", aliases: ["cloudflare", "workers"], patterns: [/cloudflare|workers/i], hints: ["部署", "边缘", "工程化", "devops"] },
  { name: "EdgeOne", aliases: ["edgeone"], patterns: [/edgeone|腾讯云/i], hints: ["部署", "边缘", "工程化", "devops"] },
  { name: "GitHub Actions", patterns: [/github actions/i], hints: ["部署", "自动化", "工程化", "ci", "devops"] },
  { name: "Docker", patterns: [/docker/i], hints: ["部署", "容器", "工程化", "devops"] },
  { name: "智谱 AI", aliases: ["zhipu", "glm"], patterns: [/智谱|zhipu|glm/i], hints: ["ai", "智能", "模型", "llm"] },
  { name: "LLM", patterns: [/\bllm\b|大模型|模型/i], hints: ["ai", "智能", "模型"] },
  { name: "Prompt", patterns: [/prompt|提示词/i], hints: ["ai", "智能", "模型"] },
  { name: "Markdown", patterns: [/markdown/i], hints: ["内容", "编辑器", "文档"] },
  { name: "JSON", patterns: [/json/i], hints: ["数据", "接口", "结构化"] },
  { name: "数据归一化", patterns: [/归一化|normalize|normalization/i], hints: ["数据", "清洗", "结构化"] },
];

export function buildSkillGroupsFromProjects(projects: Project[]): Skill[] {
  const keywords = extractSkillKeywords(projects).map((keyword) => keyword.name);
  if (!keywords.length) return [];

  return [{
    id: "skill-supplemental",
    category: "补充技能",
    content: formatSkillContent(keywords),
  }];
}

export function mergeSkillGroups(primary: Skill[], fallback: Skill[]) {
  const merged = primary
    .filter((skill) => skill.category.trim() && skill.content.trim())
    .map((skill) => ({ ...skill, content: ensureMarkdownList(skill.content) }));
  const fallbackKeywords = fallback.flatMap((skill) => parseSkillContent(skill.content));

  if (!merged.length) {
    return fallbackKeywords.length
      ? [{ id: "skill-supplemental", category: "补充技能", content: formatSkillContent(fallbackKeywords) }]
      : [];
  }

  const existingKeywords = new Set(merged.flatMap((skill) => parseSkillContent(skill.content)).map(normalizeKey));
  const supplemental: string[] = [];

  for (const keyword of fallbackKeywords) {
    if (existingKeywords.has(normalizeKey(keyword))) continue;
    const targetIndex = findBestSkillGroupIndex(keyword, merged);
    if (targetIndex >= 0) {
      merged[targetIndex] = {
        ...merged[targetIndex],
        content: appendSkillKeyword(merged[targetIndex].content, keyword),
      };
    } else {
      supplemental.push(keyword);
    }
    existingKeywords.add(normalizeKey(keyword));
  }

  if (supplemental.length > 0) {
    merged.push({
      id: "skill-supplemental",
      category: "补充技能",
      content: formatSkillContent(supplemental),
    });
  }

  return merged;
}

export function ensureMarkdownList(content: string) {
  const trimmed = content.trim();
  if (!trimmed) return "";
  if (/^\s*[-*]\s+/m.test(trimmed)) return trimmed;
  return `- ${trimmed}`;
}

function extractSkillKeywords(projects: Project[]) {
  const projectText = projects.map((project) => [
    project.title,
    project.description,
    project.content,
    ...(project.tags || []),
  ].join("\n")).join("\n");
  const tagKeys = new Set(projects.flatMap((project) => project.tags || []).map(normalizeKey));

  return skillKeywords.filter((keyword) => {
    const names = [keyword.name, ...(keyword.aliases || [])].map(normalizeKey);
    return names.some((name) => tagKeys.has(name)) || keyword.patterns.some((pattern) => pattern.test(projectText));
  });
}

function findBestSkillGroupIndex(keyword: string, skills: Skill[]) {
  const descriptor = getKeywordDescriptor(keyword);
  if (!descriptor) return -1;

  let bestIndex = -1;
  let bestScore = 0;
  skills.forEach((skill, index) => {
    const haystack = `${skill.category}\n${skill.content}`.toLowerCase();
    const score = descriptor.hints.reduce((total, hint) => total + (haystack.includes(hint.toLowerCase()) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function getKeywordDescriptor(keyword: string) {
  const key = normalizeKey(keyword);
  return skillKeywords.find((item) => [item.name, ...(item.aliases || [])].some((name) => normalizeKey(name) === key));
}

function appendSkillKeyword(content: string, keyword: string) {
  const lines = ensureMarkdownList(content).split("\n");
  const firstListIndex = lines.findIndex((line) => /^\s*[-*]\s+/.test(line));
  if (firstListIndex < 0) return `${ensureMarkdownList(content)}\n- ${keyword}`;

  lines[firstListIndex] = `${lines[firstListIndex].trim()}、${keyword}`;
  return lines.join("\n");
}

function formatSkillContent(tags: string[]) {
  const keywords = uniq(tags);
  if (!keywords.length) return "";
  return `- ${keywords.join("、")}`;
}

function parseSkillContent(content: string) {
  return content
    .replace(/^\s*[-*]\s+/gm, "")
    .split(/[、,，/；;\n]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function uniq(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}
