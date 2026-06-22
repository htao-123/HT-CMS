"use client";

import { useData } from "@/lib/data-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MarkdownText } from "@/components/MarkdownText";
import { Download, ExternalLink, Mail } from "lucide-react";
import type { ResumeItem, ResumeProject, ResumeSectionId } from "@/types";

const defaultSectionOrder: ResumeSectionId[] = ["summary", "experience", "projects", "skills", "education"];
const sectionLabels: Record<ResumeSectionId, string> = {
  summary: "个人简介",
  experience: "工作经历",
  projects: "项目经历",
  skills: "技能特长",
  education: "教育背景",
};

function normalizeSectionOrder(order?: ResumeSectionId[]) {
  const valid = Array.isArray(order)
    ? order.filter((section): section is ResumeSectionId => defaultSectionOrder.includes(section))
    : [];
  return [...valid, ...defaultSectionOrder.filter((section) => !valid.includes(section))];
}

export default function ResumePage() {
  const { profile, resume } = useData();
  const visibleExperience = resume.experience.filter(hasResumeItemContent);
  const visibleProjects = resume.projects.filter(hasResumeProjectContent);
  const visibleEducation = resume.education.filter(hasResumeItemContent);
  const visibleSkills = resume.skills.filter((skill) => skill.category.trim() && skill.content.trim());
  const orderedSections = normalizeSectionOrder(resume.sectionOrder);
  const contactItems = [profile.email, profile.socials.github, profile.socials.linkedin].filter(Boolean);

  const renderSection = (section: ResumeSectionId) => {
    if (section === "summary") {
      if (!(resume.summary || profile.bio)) return null;
      return (
        <section key={section} className="mb-8 print:mb-4">
          <SectionTitle title={sectionLabels[section]} />
          <MarkdownText content={resume.summary || profile.bio} className="text-slate-600 print:leading-6" />
        </section>
      );
    }

    if (section === "experience") {
      return (
        <ResumeSection key={section} title={sectionLabels[section]} empty={!visibleExperience.length}>
          {visibleExperience.map((item) => (
            <ResumeTimelineItem key={item.id} item={item} />
          ))}
        </ResumeSection>
      );
    }

    if (section === "projects") {
      return (
        <ResumeSection key={section} title={sectionLabels[section]} empty={!visibleProjects.length}>
          {visibleProjects.map((project) => (
            <ProjectItem key={project.id} project={project} />
          ))}
        </ResumeSection>
      );
    }

    if (section === "skills") {
      return (
        <ResumeSection key={section} title={sectionLabels[section]} empty={!visibleSkills.length}>
          <div className="divide-y divide-slate-200 border-y border-slate-200">
            {visibleSkills.map((skillGroup) => (
              <div key={skillGroup.id} className="grid gap-2 py-3 sm:grid-cols-[132px_1fr] print:grid-cols-[110px_1fr] print:py-2">
                <h3 className="text-sm font-semibold leading-6 text-slate-950">{skillGroup.category}</h3>
                <MarkdownText content={skillGroup.content} className="text-slate-600 print:leading-6" />
              </div>
            ))}
          </div>
        </ResumeSection>
      );
    }

    return (
      <ResumeSection key={section} title={sectionLabels[section]} empty={!visibleEducation.length}>
        {visibleEducation.map((item) => (
          <ResumeTimelineItem key={item.id} item={item} />
        ))}
      </ResumeSection>
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8 dark:bg-background print:bg-white print:px-0 print:py-0">
      <div className="mx-auto max-w-[860px] bg-white px-6 py-8 text-slate-950 shadow-sm ring-1 ring-slate-200 sm:px-10 sm:py-10 print:max-w-none print:px-0 print:py-0 print:shadow-none print:ring-0">
        <header className="mb-8 border-b border-slate-200 pb-6 print:mb-4 print:pb-4">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-3xl font-bold leading-tight text-slate-950 print:text-2xl">
                {profile.name || "未填写姓名"}
              </h1>
              <p className="mt-2 text-base font-medium text-slate-600 print:text-sm">
                {profile.title || "未填写职位"}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600 print:text-xs">
                {contactItems.map((item, index) => (
                  <span key={item} className="inline-flex items-center gap-2">
                    {index > 0 && <span className="text-slate-300">/</span>}
                    <span>{item}</span>
                  </span>
                ))}
              </div>
            </div>
            <div className="flex gap-2 print:hidden">
              <Button variant="outline" size="sm" className="border-slate-300 bg-white text-slate-900 hover:bg-slate-100" onClick={() => window.print()}>
                <Download className="h-4 w-4" /> 打印
              </Button>
              {profile.email && (
                <Button size="sm" className="bg-slate-900 text-white hover:bg-slate-800" asChild>
                  <a href={`mailto:${profile.email}`}>
                    <Mail className="h-4 w-4" /> 联系
                  </a>
                </Button>
              )}
            </div>
          </div>
        </header>

        <main>
          {orderedSections.map(renderSection)}
        </main>
      </div>
    </div>
  );
}

function hasResumeItemContent(item: ResumeItem) {
  return Boolean(
    item.title.trim() ||
    item.subtitle.trim() ||
    item.period.trim() ||
    item.description.trim() ||
    item.location?.trim() ||
    item.highlights?.trim() ||
    item.tags?.some((tag) => tag.trim())
  );
}

function hasResumeProjectContent(project: ResumeProject) {
  return Boolean(
    project.title.trim() ||
    project.role?.trim() ||
    project.period?.trim() ||
    project.description.trim() ||
    project.highlights.trim() ||
    project.tags.some((tag) => tag.trim())
  );
}

function ResumeSection({
  title,
  empty,
  children,
}: {
  title: string;
  empty: boolean;
  children: React.ReactNode;
}) {
  if (empty) return null;

  return (
    <section className="mb-8 print:mb-4">
      <SectionTitle title={title} />
      <div className="space-y-5 print:space-y-3">{children}</div>
    </section>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <h2 className="mb-4 border-b border-slate-200 pb-2 text-sm font-bold uppercase text-slate-950 print:mb-2 print:pb-1">
      {title}
    </h2>
  );
}

function ResumeTimelineItem({ item }: { item: ResumeItem }) {
  return (
    <article className="grid gap-3 border-b border-slate-200 pb-5 last:border-b-0 last:pb-0 md:grid-cols-[150px_1fr] print:grid-cols-[115px_1fr] print:gap-3 print:pb-3">
      <div className="text-xs font-medium leading-6 text-slate-500">
        <div>{item.period}</div>
        {item.location && <div>{item.location}</div>}
      </div>
      <div>
        <h3 className="text-base font-bold leading-6 text-slate-950">{item.title}</h3>
        {item.subtitle && <div className="text-sm font-medium text-slate-700">{item.subtitle}</div>}
        {item.description && (
          <MarkdownText content={item.description} className="mt-2 text-slate-600" />
        )}
        {item.highlights && <MarkdownText content={item.highlights} className="mt-2 text-slate-600" />}
        {item.tags && item.tags.length > 0 && <TagList tags={item.tags} />}
      </div>
    </article>
  );
}

function ProjectItem({ project }: { project: ResumeProject }) {
  return (
    <article className="grid gap-3 border-b border-slate-200 pb-5 last:border-b-0 last:pb-0 md:grid-cols-[150px_1fr] print:grid-cols-[115px_1fr] print:gap-3 print:pb-3">
      <div className="text-xs font-medium leading-6 text-slate-500">{project.period}</div>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-bold leading-6 text-slate-950">{project.title}</h3>
          {project.showLink && project.link && (
            <a
              href={project.link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 underline-offset-4 hover:underline print:text-slate-500"
            >
              链接 <ExternalLink className="h-3 w-3 print:hidden" />
            </a>
          )}
        </div>
        {project.role && <div className="text-sm font-medium text-slate-700">{project.role}</div>}
        {project.description && (
          <MarkdownText content={project.description} className="mt-2 text-slate-600" />
        )}
        {project.highlights && <MarkdownText content={project.highlights} className="mt-2 text-slate-600" />}
        {project.tags.length > 0 && <TagList tags={project.tags} />}
      </div>
    </article>
  );
}

function TagList({ tags }: { tags: string[] }) {
  const visibleTags = tags.filter((tag) => tag.trim());
  if (!visibleTags.length) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {visibleTags.map((tag) => (
        <Badge key={tag} variant="outline" className="rounded-md border-slate-200 font-medium text-slate-700 print:bg-transparent print:text-xs">
          {tag}
        </Badge>
      ))}
    </div>
  );
}
