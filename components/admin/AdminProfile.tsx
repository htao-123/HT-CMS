"use client";

import { useEffect, useState } from "react";
import { useData } from "@/lib/data-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import type { ResumeData, ResumeItem, ResumeProject, ResumeSectionId, Skill } from "@/types";
import { ArrowDown, ArrowUp, Eye, Github, Linkedin, Plus, Save, Sparkles, Trash2, User, WandSparkles, X as TwitterIcon } from "lucide-react";

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function linesToList(value: string) {
  return value.split("\n").map((line) => line.trim()).filter(Boolean);
}

function listToLines(value?: string[]) {
  return (value || []).join("\n");
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= items.length) return items;
  const next = [...items];
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  return next;
}

const defaultSectionOrder: ResumeSectionId[] = ["summary", "experience", "projects", "skills", "education"];
const sectionLabels: Record<ResumeSectionId, string> = {
  summary: "个人简介",
  experience: "工作经历",
  projects: "项目经历",
  skills: "技能分组",
  education: "教育背景",
};

function normalizeSectionOrder(order?: ResumeSectionId[]) {
  const valid = Array.isArray(order)
    ? order.filter((section): section is ResumeSectionId => defaultSectionOrder.includes(section))
    : [];
  return [...valid, ...defaultSectionOrder.filter((section) => !valid.includes(section))];
}

function getProjectLink(project: { link?: string; github?: string }) {
  return project.link || project.github || "";
}

function summarizeProjectContent(content: string) {
  const clean = content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[[^\]]+\]\([^)]+\)/g, " ")
    .replace(/[#>*_`~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return clean.slice(0, 120);
}

function uniq(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
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
  };
  return aliases[value.toLowerCase()] || value;
}

function inferProjectFocus(tags: string[]) {
  const lowerTags = tags.map((tag) => tag.toLowerCase());
  if (lowerTags.some((tag) => ["dart", "flutter", "kotlin", "swift"].includes(tag))) {
    return "跨端应用";
  }
  if (lowerTags.some((tag) => ["react", "next.js", "nextjs", "vue"].includes(tag))) {
    return "前端应用";
  }
  if (lowerTags.some((tag) => ["python", "fastapi", "node", "node.js", "express"].includes(tag))) {
    return "后端服务";
  }
  if (lowerTags.some((tag) => ["rust", "c++", "c"].includes(tag))) {
    return "基础能力";
  }
  return "产品功能";
}

function groupSkills(tags: string[]): Skill[] {
  const normalizedTags = uniq(tags.map(normalizeTechName));
  const groups = [
    {
      id: "skill-client",
      category: "客户端与跨端开发",
      match: ["Dart", "Flutter", "Kotlin", "Swift", "C++", "CMake", "Objective-C"],
    },
    {
      id: "skill-frontend",
      category: "前端开发",
      match: ["React", "Vue", "Next.js", "TypeScript", "JavaScript", "Tailwind CSS"],
    },
    {
      id: "skill-backend",
      category: "后端与工程化",
      match: ["Python", "FastAPI", "Node.js", "Express", "Rust", "Shell"],
    },
  ];

  const skillGroups = groups
    .map((group) => ({
      id: group.id,
      category: group.category,
      items: normalizedTags.filter((tag) => group.match.includes(tag)).slice(0, 8),
    }))
    .filter((group) => group.items.length > 0);

  const used = new Set(skillGroups.flatMap((group) => group.items));
  const others = normalizedTags.filter((tag) => !used.has(tag)).slice(0, 8);
  if (others.length > 0) {
    skillGroups.push({ id: "skill-other", category: "其他技术", items: others });
  }

  return skillGroups;
}

function cleanResume(resume: ResumeData): ResumeData {
  const hasItemContent = (item: ResumeItem) => Boolean(
    item.title.trim() ||
    item.subtitle.trim() ||
    item.period.trim() ||
    item.description.trim() ||
    item.location?.trim() ||
    item.highlights?.some((highlight) => highlight.trim()) ||
    item.tags?.some((tag) => tag.trim())
  );
  const hasProjectContent = (project: ResumeProject) => Boolean(
    project.title.trim() ||
    project.role?.trim() ||
    project.period?.trim() ||
    project.description.trim() ||
    project.highlights.some((highlight) => highlight.trim()) ||
    project.tags.some((tag) => tag.trim())
  );

  return {
    summary: resume.summary.trim(),
    experience: resume.experience.filter(hasItemContent),
    projects: resume.projects.filter(hasProjectContent).map((project) => ({
      ...project,
      highlights: uniq(project.highlights),
      tags: uniq(project.tags.map(normalizeTechName)),
    })),
    education: resume.education.filter(hasItemContent),
    skills: resume.skills
      .map((skill) => ({ ...skill, items: uniq(skill.items.map(normalizeTechName)) }))
      .filter((skill) => skill.category.trim() && skill.items.length > 0),
    sectionOrder: normalizeSectionOrder(resume.sectionOrder),
  };
}

function buildBasicResumeDraft(
  targetRole: string,
  profileBio: string,
  selectedProjects: ReturnType<typeof useData>["projects"]
): Pick<ResumeData, "summary" | "projects" | "skills"> {
  const allTags = selectedProjects.flatMap((project) => project.tags || []);
  const uniqueTags = uniq(allTags.map(normalizeTechName));
  const projectTitles = selectedProjects.map((project) => project.title).filter(Boolean);
  const role = targetRole.trim() || "软件工程师";

  const summaryParts = [
    profileBio ? `${profileBio}。` : "",
    `目标方向为${role}，具备从需求拆解、功能实现到部署交付的完整项目经验。`,
    projectTitles.length ? `代表项目包括 ${projectTitles.slice(0, 3).join("、")}。` : "",
    uniqueTags.length ? `熟悉 ${uniqueTags.slice(0, 8).join("、")} 等技术栈。` : "",
  ].filter(Boolean);

  return {
    summary: summaryParts.join(""),
    projects: selectedProjects.map((project): ResumeProject => {
      const tags = uniq((project.tags || []).map(normalizeTechName));
      const contentSummary = summarizeProjectContent(project.content || "");
      const focus = inferProjectFocus(tags);
      return {
        id: `resume-${project.id}`,
        sourceType: "linked",
        projectId: project.id,
        title: project.title,
        role,
        period: "",
        description: project.description || contentSummary,
        highlights: [
          `围绕${project.description || project.title}拆解核心使用场景，完成${focus}的功能设计、开发与体验打磨。`,
          tags.length ? `基于 ${tags.slice(0, 6).join("、")} 构建主要能力，覆盖界面交互、数据处理和多端适配等环节。` : "",
          contentSummary ? `结合项目文档沉淀实现细节，保证功能可维护、可迭代。` : "负责项目从方案到落地的实现，关注可维护性与实际使用体验。",
        ].filter(Boolean).slice(0, 3),
        tags,
        link: getProjectLink(project),
        showLink: true,
      };
    }),
    skills: groupSkills(uniqueTags),
  };
}

export function AdminProfile() {
  const { profile, resume, projects, updateProfile, updateResume, pushProfile, pushResume, isPushing } = useData();
  const [profileForm, setProfileForm] = useState(profile);
  const [resumeForm, setResumeForm] = useState<ResumeData>(resume);
  const [saveMessage, setSaveMessage] = useState("");
  const [targetRole, setTargetRole] = useState(profile.title || "前端工程师");
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [isGeneratingResume, setIsGeneratingResume] = useState(false);
  const [generateMessage, setGenerateMessage] = useState("");

  useEffect(() => {
    setProfileForm(profile);
  }, [profile]);

  useEffect(() => {
    setResumeForm(resume);
  }, [resume]);

  useEffect(() => {
    if (selectedProjectIds.length === 0 && projects.length > 0) {
      setSelectedProjectIds(projects.slice(0, 4).map((project) => project.id));
    }
  }, [projects, selectedProjectIds.length]);

  const setResumeField = <K extends keyof ResumeData>(key: K, value: ResumeData[K]) => {
    setResumeForm((current) => ({ ...current, [key]: value }));
  };

  const moveSection = (section: ResumeSectionId, direction: -1 | 1) => {
    const order = normalizeSectionOrder(resumeForm.sectionOrder);
    const index = order.indexOf(section);
    setResumeField("sectionOrder", moveItem(order, index, direction));
  };

  const updateExperience = (index: number, item: ResumeItem) => {
    const next = [...resumeForm.experience];
    next[index] = item;
    setResumeField("experience", next);
  };

  const updateEducation = (index: number, item: ResumeItem) => {
    const next = [...resumeForm.education];
    next[index] = item;
    setResumeField("education", next);
  };

  const updateResumeProject = (index: number, item: ResumeProject) => {
    const next = [...resumeForm.projects];
    next[index] = item;
    setResumeField("projects", next);
  };

  const updateSkillGroup = (index: number, item: Skill) => {
    const next = [...resumeForm.skills];
    next[index] = item;
    setResumeField("skills", next);
  };

  const addExperience = () => {
    setResumeField("experience", [
      ...resumeForm.experience,
      { id: createId("exp"), title: "", subtitle: "", period: "", location: "", description: "", highlights: [], tags: [] },
    ]);
  };

  const addEducation = () => {
    setResumeField("education", [
      ...resumeForm.education,
      { id: createId("edu"), title: "", subtitle: "", period: "", location: "", description: "" },
    ]);
  };

  const addProject = () => {
    setResumeField("projects", [
      ...resumeForm.projects,
      { id: createId("rproj"), sourceType: "custom", title: "", role: "", period: "", description: "", highlights: [], tags: [], link: "", showLink: true },
    ]);
  };

  const addSkillGroup = () => {
    setResumeField("skills", [
      ...resumeForm.skills,
      { id: createId("skill"), category: "新技能分组", items: [] },
    ]);
  };

  const handleLinkedProjectChange = (index: number, projectId: string) => {
    const linkedProject = projects.find((project) => project.id === projectId);
    const current = resumeForm.projects[index];
    updateResumeProject(index, {
      ...current,
      sourceType: "linked",
      projectId,
      title: current.title || linkedProject?.title || "",
      description: current.description || linkedProject?.description || "",
      tags: current.tags.length > 0 ? current.tags : linkedProject?.tags || [],
      link: current.link || linkedProject?.link || linkedProject?.github || "",
      showLink: current.showLink ?? true,
    });
  };

  const selectedProjects = projects.filter((project) => selectedProjectIds.includes(project.id));

  const applyGeneratedResume = (draft: Pick<ResumeData, "summary" | "projects" | "skills">) => {
    setResumeForm((current) => ({
      ...current,
      summary: draft.summary || current.summary,
      projects: draft.projects,
      skills: draft.skills,
      sectionOrder: normalizeSectionOrder(current.sectionOrder),
    }));
  };

  const handleBasicGenerate = () => {
    if (selectedProjects.length === 0) {
      setGenerateMessage("请至少选择一个项目");
      return;
    }

    const draft = buildBasicResumeDraft(targetRole, profileForm.bio, selectedProjects);
    applyGeneratedResume(draft);
    setGenerateMessage("已生成基础版，可到预览查看");
  };

  const handleAiGenerate = async () => {
    if (selectedProjects.length === 0) {
      setGenerateMessage("请至少选择一个项目");
      return;
    }

    setIsGeneratingResume(true);
    setGenerateMessage("AI 正在生成...");

    try {
      const fallbackDraft = buildBasicResumeDraft(targetRole, profileForm.bio, selectedProjects);
      const response = await fetch("/api/ai/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetRole,
          profile: profileForm,
          projects: selectedProjects,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.resume) {
        applyGeneratedResume(fallbackDraft);
        setGenerateMessage(data.error ? `AI 生成失败，已生成基础版：${data.error}` : "AI 生成失败，已生成基础版");
        return;
      }

      applyGeneratedResume({
        summary: data.resume.summary || fallbackDraft.summary,
        projects: data.resume.projects?.length ? data.resume.projects : fallbackDraft.projects,
        skills: data.resume.skills?.length ? data.resume.skills : fallbackDraft.skills,
      });
      setGenerateMessage("AI 优化完成，可到预览查看");
    } catch (error) {
      const fallbackDraft = buildBasicResumeDraft(targetRole, profileForm.bio, selectedProjects);
      applyGeneratedResume(fallbackDraft);
      setGenerateMessage(`AI 生成失败，已生成基础版：${error instanceof Error ? error.message : "未知错误"}`);
    } finally {
      setIsGeneratingResume(false);
    }
  };

  const toggleProjectSelection = (projectId: string, checked: boolean) => {
    setSelectedProjectIds((current) => (
      checked ? Array.from(new Set([...current, projectId])) : current.filter((id) => id !== projectId)
    ));
  };

  const handleSave = async () => {
    updateProfile(profileForm);
    const cleanedResume = cleanResume(resumeForm);
    updateResume(cleanedResume);
    setSaveMessage("保存中...");

    const profileOk = await pushProfile(profileForm);
    const resumeOk = await pushResume(cleanedResume);
    setSaveMessage(profileOk && resumeOk ? "已保存到 GitHub" : "保存失败，请稍后重试");
  };

  const renderItemControls = (onMoveUp: () => void, onMoveDown: () => void, onDelete: () => void) => (
    <div className="flex items-center gap-1">
      <Button type="button" variant="ghost" size="sm" onClick={onMoveUp} title="上移"><ArrowUp className="h-4 w-4" /></Button>
      <Button type="button" variant="ghost" size="sm" onClick={onMoveDown} title="下移"><ArrowDown className="h-4 w-4" /></Button>
      <Button type="button" variant="ghost" size="sm" onClick={onDelete} title="删除"><Trash2 className="h-4 w-4" /></Button>
    </div>
  );
  const previewResume = cleanResume(resumeForm);
  const selectedCount = selectedProjects.length;
  const generatedSections = [
    previewResume.summary ? "简介" : "",
    previewResume.projects.length ? `${previewResume.projects.length} 个项目` : "",
    previewResume.skills.length ? `${previewResume.skills.length} 组技能` : "",
    previewResume.experience.length ? `${previewResume.experience.length} 段经历` : "",
    previewResume.education.length ? `${previewResume.education.length} 段教育` : "",
  ].filter(Boolean);
  const orderedSections = normalizeSectionOrder(previewResume.sectionOrder);
  const renderPreviewModule = (section: ResumeSectionId) => {
    if (section === "summary") {
      return (
        <PreviewSection key={section} title="简介">
          <p className="text-sm leading-7 text-muted-foreground">{previewResume.summary || profileForm.bio || "暂无简介"}</p>
        </PreviewSection>
      );
    }
    if (section === "experience" && previewResume.experience.length > 0) {
      return (
        <PreviewSection key={section} title="工作经历">
          {previewResume.experience.map((item) => <PreviewItem key={item.id} title={item.title} subtitle={item.subtitle} period={item.period} description={item.description} highlights={item.highlights} tags={item.tags} />)}
        </PreviewSection>
      );
    }
    if (section === "projects" && previewResume.projects.length > 0) {
      return (
        <PreviewSection key={section} title="项目经历">
          {previewResume.projects.map((item) => <PreviewItem key={item.id} title={item.title} subtitle={item.role} period={item.period} description={item.description} highlights={item.highlights} tags={item.tags} />)}
        </PreviewSection>
      );
    }
    if (section === "skills" && previewResume.skills.length > 0) {
      return (
        <PreviewSection key={section} title="技能分组">
          <div className="grid gap-3 sm:grid-cols-2">
            {previewResume.skills.map((group) => (
              <div key={group.id} className="rounded-lg border p-4">
                <div className="font-semibold">{group.category}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {group.items.map((item) => <Badge key={item} variant="secondary">{item}</Badge>)}
                </div>
              </div>
            ))}
          </div>
        </PreviewSection>
      );
    }
    if (section === "education" && previewResume.education.length > 0) {
      return (
        <PreviewSection key={section} title="教育背景">
          {previewResume.education.map((item) => <PreviewItem key={item.id} title={item.title} subtitle={item.subtitle} period={item.period} description={item.description} />)}
        </PreviewSection>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">个人设置</h2>
            <p className="text-sm text-muted-foreground">编辑个人资料、展示简历和投递简历内容</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {saveMessage && <span className="text-sm text-muted-foreground">{saveMessage}</span>}
          <Button size="lg" onClick={handleSave} disabled={isPushing} className="gap-2">
            <Save className="h-4 w-4" />
            {isPushing ? "保存中" : "保存更改"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="generate" className="w-full">
        <TabsList className="mb-5 grid h-auto w-full grid-cols-3 bg-muted/70 p-1 shadow-sm">
          <TabsTrigger value="generate" className="h-10 gap-2"><Sparkles className="h-4 w-4" />智能生成</TabsTrigger>
          <TabsTrigger value="basic" className="h-10 gap-2"><User className="h-4 w-4" />编辑内容</TabsTrigger>
          <TabsTrigger value="preview" className="h-10 gap-2"><Eye className="h-4 w-4" />预览</TabsTrigger>
        </TabsList>

        <TabsContent value="generate">
          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border bg-background p-4">
                <p className="text-xs font-medium uppercase text-muted-foreground">目标岗位</p>
                <p className="mt-2 truncate text-lg font-semibold">{targetRole || "未设置"}</p>
              </div>
              <div className="rounded-lg border bg-background p-4">
                <p className="text-xs font-medium uppercase text-muted-foreground">已选项目</p>
                <p className="mt-2 text-lg font-semibold">{selectedCount} / {projects.length}</p>
              </div>
              <div className="rounded-lg border bg-background p-4">
                <p className="text-xs font-medium uppercase text-muted-foreground">当前初稿</p>
                <p className="mt-2 truncate text-lg font-semibold">
                  {generatedSections.length ? generatedSections.join("、") : "尚未生成"}
                </p>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
              <Card className="self-start">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    简历生成
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-2">
                    <Label>目标岗位</Label>
                    <Input
                      value={targetRole}
                      onChange={(e) => setTargetRole(e.target.value)}
                      placeholder="前端工程师、AI 应用工程师、全栈工程师"
                    />
                  </div>

                  <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 text-sm">
                    <div className="flex items-start gap-3">
                      <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                      <p className="text-muted-foreground">基础生成会复用已有项目、技术栈和个人简介，快速生成能看的初稿。</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                      <p className="text-muted-foreground">AI 优化会调用智谱，将项目改写为职责、技术实现和交付价值。</p>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Button type="button" onClick={handleAiGenerate} disabled={selectedCount === 0 || isGeneratingResume} className="h-11 gap-2">
                      <WandSparkles className="h-4 w-4" />
                      {isGeneratingResume ? "正在优化简历" : "AI 优化生成"}
                    </Button>
                    <Button type="button" variant="outline" onClick={handleBasicGenerate} disabled={selectedCount === 0 || isGeneratingResume} className="h-10">
                      只生成基础版
                    </Button>
                  </div>

                  {generateMessage && (
                    <div className="rounded-lg border bg-background p-3 text-sm text-muted-foreground">
                      {generateMessage}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex-row items-start justify-between space-y-0 pb-3">
                  <div>
                    <CardTitle>项目素材</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">勾选后会进入简历项目经历，建议保留 2-4 个最能代表能力的项目。</p>
                  </div>
                  {projects.length > 0 && (
                    <div className="flex shrink-0 gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => setSelectedProjectIds(projects.map((project) => project.id))}>
                        全选
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => setSelectedProjectIds([])}>
                        清空
                      </Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  {projects.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
                      暂无项目。先导入或新增项目后，就可以一键生成项目经历。
                    </div>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      {projects.map((project) => {
                        const checked = selectedProjectIds.includes(project.id);
                        return (
                          <label
                            key={project.id}
                            className={`flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors ${
                              checked ? "border-primary/60 bg-primary/5" : "hover:bg-muted/40"
                            }`}
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(nextChecked) => toggleProjectSelection(project.id, nextChecked)}
                              className="mt-1"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2">
                                <span className="truncate font-medium">{project.title}</span>
                                {checked && <Badge variant="secondary">已选</Badge>}
                              </span>
                              {project.description && (
                                <span className="mt-1 line-clamp-2 block text-sm leading-6 text-muted-foreground">{project.description}</span>
                              )}
                              {project.tags.length > 0 && (
                                <span className="mt-3 flex flex-wrap gap-1.5">
                                  {project.tags.slice(0, 5).map((tag) => (
                                    <Badge key={tag} variant="outline">{tag}</Badge>
                                  ))}
                                  {project.tags.length > 5 && <Badge variant="outline">+{project.tags.length - 5}</Badge>}
                                </span>
                              )}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle>生成结果概览</CardTitle>
              </CardHeader>
              <CardContent>
                {generatedSections.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                    生成后会在这里看到简介、项目经历和技能分组概览。
                  </div>
                ) : (
                  <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
                    <div className="rounded-lg border bg-muted/20 p-4">
                      <p className="mb-2 text-sm font-medium">简介</p>
                      <p className="text-sm leading-7 text-muted-foreground">{previewResume.summary || profileForm.bio || "暂无简介"}</p>
                    </div>
                    <div className="grid gap-3">
                      {previewResume.projects.slice(0, 3).map((project) => (
                        <div key={project.id} className="rounded-lg border p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{project.title}</p>
                            {project.role && <Badge variant="secondary">{project.role}</Badge>}
                          </div>
                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{project.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="basic">
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <Card>
              <CardHeader><CardTitle>基础信息</CardTitle></CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-2"><Label>姓名</Label><Input value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} /></div>
                <div className="grid gap-2"><Label>职位</Label><Input value={profileForm.title} onChange={(e) => setProfileForm({ ...profileForm, title: e.target.value })} /></div>
                <div className="grid gap-2"><Label>头像 URL</Label><Input value={profileForm.avatarUrl || ""} onChange={(e) => setProfileForm({ ...profileForm, avatarUrl: e.target.value })} /></div>
                <div className="grid gap-2"><Label>邮箱</Label><Input type="email" value={profileForm.email} onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })} /></div>
                <div className="grid gap-2"><Label>个人简介</Label><Textarea value={profileForm.bio} onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })} rows={4} /></div>
                <div className="grid gap-2"><Label>简历摘要</Label><Textarea value={resumeForm.summary} onChange={(e) => setResumeField("summary", e.target.value)} rows={4} /></div>
              </CardContent>
              </Card>

              <Card>
              <CardHeader><CardTitle>社交链接</CardTitle></CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-2"><Label className="flex items-center gap-2"><Github className="h-4 w-4" /> GitHub</Label><Input value={profileForm.socials.github || ""} onChange={(e) => setProfileForm({ ...profileForm, socials: { ...profileForm.socials, github: e.target.value } })} /></div>
                <div className="grid gap-2"><Label className="flex items-center gap-2"><Linkedin className="h-4 w-4" /> LinkedIn</Label><Input value={profileForm.socials.linkedin || ""} onChange={(e) => setProfileForm({ ...profileForm, socials: { ...profileForm.socials, linkedin: e.target.value } })} /></div>
                <div className="grid gap-2"><Label className="flex items-center gap-2"><TwitterIcon className="h-4 w-4" /> Twitter / X</Label><Input value={profileForm.socials.twitter || ""} onChange={(e) => setProfileForm({ ...profileForm, socials: { ...profileForm.socials, twitter: e.target.value } })} /></div>
              </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>模块顺序</CardTitle>
                <p className="text-sm text-muted-foreground">这里控制预览和公开简历里的展示顺序。</p>
              </CardHeader>
              <CardContent className="grid gap-2">
                {normalizeSectionOrder(resumeForm.sectionOrder).map((section, index, order) => (
                  <div key={section} className="flex items-center justify-between rounded-lg border bg-background p-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-sm font-medium text-muted-foreground">{index + 1}</span>
                      <span className="font-medium">{sectionLabels[section]}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button type="button" variant="ghost" size="sm" onClick={() => moveSection(section, -1)} disabled={index === 0} title="上移">
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => moveSection(section, 1)} disabled={index === order.length - 1} title="下移">
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <section className="space-y-4">
              <SectionHeader title="工作经历" action="添加经历" onAdd={addExperience} />
              <div className="grid gap-4">
            {resumeForm.experience.map((item, index) => (
              <Card key={item.id}>
                <CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle className="text-base">{item.title || "未命名经历"}</CardTitle>{renderItemControls(() => setResumeField("experience", moveItem(resumeForm.experience, index, -1)), () => setResumeField("experience", moveItem(resumeForm.experience, index, 1)), () => setResumeField("experience", resumeForm.experience.filter((_, i) => i !== index)))}</CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <Field label="职位" value={item.title} onChange={(value) => updateExperience(index, { ...item, title: value })} />
                  <Field label="公司" value={item.subtitle} onChange={(value) => updateExperience(index, { ...item, subtitle: value })} />
                  <Field label="时间" value={item.period} onChange={(value) => updateExperience(index, { ...item, period: value })} />
                  <Field label="地点" value={item.location || ""} onChange={(value) => updateExperience(index, { ...item, location: value })} />
                  <TextField label="职责描述" value={item.description} onChange={(value) => updateExperience(index, { ...item, description: value })} />
                  <TextField label="亮点，一行一条" value={listToLines(item.highlights)} onChange={(value) => updateExperience(index, { ...item, highlights: linesToList(value) })} />
                  <Field label="技术栈，逗号分隔" value={(item.tags || []).join(", ")} onChange={(value) => updateExperience(index, { ...item, tags: value.split(",").map((tag) => tag.trim()).filter(Boolean) })} />
                </CardContent>
              </Card>
            ))}
              </div>
            </section>

            <section className="space-y-4">
              <SectionHeader title="项目经历" action="添加项目" onAdd={addProject} />
              <div className="grid gap-4">
            {resumeForm.projects.map((item, index) => (
              <Card key={item.id}>
                <CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle className="text-base">{item.title || "未命名项目"}</CardTitle>{renderItemControls(() => setResumeField("projects", moveItem(resumeForm.projects, index, -1)), () => setResumeField("projects", moveItem(resumeForm.projects, index, 1)), () => setResumeField("projects", resumeForm.projects.filter((_, i) => i !== index)))}</CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>来源</Label>
                    <Select value={item.sourceType} onValueChange={(value) => updateResumeProject(index, { ...item, sourceType: value as ResumeProject["sourceType"] })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="custom">手动维护</SelectItem><SelectItem value="linked">关联已有项目</SelectItem></SelectContent>
                    </Select>
                  </div>
                  {item.sourceType === "linked" && (
                    <div className="grid gap-2">
                      <Label>选择项目</Label>
                      <Select value={item.projectId || ""} onValueChange={(value) => handleLinkedProjectChange(index, value)}>
                        <SelectTrigger><SelectValue placeholder="选择已有项目" /></SelectTrigger>
                        <SelectContent>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.title}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  )}
                  <Field label="项目名" value={item.title} onChange={(value) => updateResumeProject(index, { ...item, title: value })} />
                  <Field label="我的角色" value={item.role || ""} onChange={(value) => updateResumeProject(index, { ...item, role: value })} />
                  <Field label="时间" value={item.period || ""} onChange={(value) => updateResumeProject(index, { ...item, period: value })} />
                  <Field label="链接" value={item.link || ""} onChange={(value) => updateResumeProject(index, { ...item, link: value })} />
                  <TextField label="项目摘要" value={item.description} onChange={(value) => updateResumeProject(index, { ...item, description: value })} />
                  <TextField label="亮点，一行一条" value={listToLines(item.highlights)} onChange={(value) => updateResumeProject(index, { ...item, highlights: linesToList(value) })} />
                  <Field label="技术栈，逗号分隔" value={item.tags.join(", ")} onChange={(value) => updateResumeProject(index, { ...item, tags: value.split(",").map((tag) => tag.trim()).filter(Boolean) })} />
                </CardContent>
              </Card>
            ))}
              </div>
            </section>

            <section className="space-y-4">
              <SectionHeader title="教育背景" action="添加教育" onAdd={addEducation} />
              <div className="grid gap-4">
            {resumeForm.education.map((item, index) => (
              <Card key={item.id}>
                <CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle className="text-base">{item.title || "未命名教育经历"}</CardTitle>{renderItemControls(() => setResumeField("education", moveItem(resumeForm.education, index, -1)), () => setResumeField("education", moveItem(resumeForm.education, index, 1)), () => setResumeField("education", resumeForm.education.filter((_, i) => i !== index)))}</CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <Field label="学校 / 机构" value={item.title} onChange={(value) => updateEducation(index, { ...item, title: value })} />
                  <Field label="专业 / 学位" value={item.subtitle} onChange={(value) => updateEducation(index, { ...item, subtitle: value })} />
                  <Field label="时间" value={item.period} onChange={(value) => updateEducation(index, { ...item, period: value })} />
                  <Field label="地点" value={item.location || ""} onChange={(value) => updateEducation(index, { ...item, location: value })} />
                  <TextField label="说明" value={item.description} onChange={(value) => updateEducation(index, { ...item, description: value })} />
                </CardContent>
              </Card>
            ))}
              </div>
            </section>

            <section className="space-y-4">
              <SectionHeader title="技能分组" action="添加分组" onAdd={addSkillGroup} />
              <div className="grid gap-4 md:grid-cols-2">
            {resumeForm.skills.map((group, index) => (
              <Card key={group.id}>
                <CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle className="text-base">{group.category}</CardTitle>{renderItemControls(() => setResumeField("skills", moveItem(resumeForm.skills, index, -1)), () => setResumeField("skills", moveItem(resumeForm.skills, index, 1)), () => setResumeField("skills", resumeForm.skills.filter((_, i) => i !== index)))}</CardHeader>
                <CardContent className="grid gap-4">
                  <Field label="分组名" value={group.category} onChange={(value) => updateSkillGroup(index, { ...group, category: value })} />
                  <TextField label="技能，一行一项" value={listToLines(group.items)} onChange={(value) => updateSkillGroup(index, { ...group, items: linesToList(value) })} />
                </CardContent>
              </Card>
            ))}
              </div>
            </section>
          </div>
        </TabsContent>

        <TabsContent value="preview">
          <Card>
            <CardContent className="p-8">
              <div className="mb-8 flex flex-col gap-2 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
                <div><h3 className="text-3xl font-bold">{profileForm.name || "姓名"}</h3><p className="text-muted-foreground">{profileForm.title || "职位"}</p></div>
                <p className="text-sm text-muted-foreground">{profileForm.email}</p>
              </div>
              {orderedSections.map(renderPreviewModule)}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SectionHeader({ title, action, onAdd }: { title: string; action: string; onAdd: () => void }) {
  return <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-semibold">{title}</h3><Button type="button" onClick={onAdd} className="gap-2"><Plus className="h-4 w-4" />{action}</Button></div>;
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <div className="grid gap-2"><Label>{label}</Label><Input value={value} onChange={(e) => onChange(e.target.value)} /></div>;
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <div className="grid gap-2 md:col-span-2"><Label>{label}</Label><Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={4} /></div>;
}

function PreviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mb-8"><h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4><div className="space-y-5">{children}</div></section>;
}

function PreviewItem({ title, subtitle, period, description, highlights, tags }: { title?: string; subtitle?: string; period?: string; description?: string; highlights?: string[]; tags?: string[] }) {
  return <div className="grid gap-2 sm:grid-cols-[150px_1fr]"><div className="text-xs font-medium uppercase text-muted-foreground">{period}</div><div><div className="font-semibold">{title}</div>{subtitle && <div className="text-sm text-primary">{subtitle}</div>}{description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}{highlights && highlights.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">{highlights.map((item) => <li key={item}>{item}</li>)}</ul>}{tags && tags.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{tags.map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>)}</div>}</div></div>;
}
