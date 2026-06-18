"use client";

import { useData } from "@/lib/data-context";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, Mail } from "lucide-react";
import type { ResumeItem, ResumeProject } from "@/types";

export default function ResumePage() {
  const { profile, resume } = useData();
  const visibleExperience = resume.experience.filter(hasResumeItemContent);
  const visibleProjects = resume.projects.filter(hasResumeProjectContent);
  const visibleEducation = resume.education.filter(hasResumeItemContent);
  const visibleSkills = resume.skills.filter((skill) => skill.category.trim() && skill.items.some((item) => item.trim()));

  return (
    <div className="container min-h-screen px-4 py-10 print:py-0">
      <div className="mx-auto max-w-4xl print:max-w-none">
        <header className="mb-10 flex flex-col gap-6 border-b pb-8 md:flex-row md:items-end md:justify-between print:mb-5 print:pb-4">
          <div className="flex items-start gap-5">
            {profile.avatarUrl && (
              <img
                src={profile.avatarUrl}
                alt={profile.name}
                className="h-20 w-20 rounded-2xl object-cover print:hidden"
              />
            )}
            <div>
              <h1 className="font-display text-4xl font-bold print:text-3xl">
                {profile.name || "未填写姓名"}
              </h1>
              <p className="mt-2 text-xl text-muted-foreground print:text-base">
                {profile.title || "未填写职位"}
              </p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {profile.email && <span>{profile.email}</span>}
                {profile.socials.github && <span>{profile.socials.github}</span>}
                {profile.socials.linkedin && <span>{profile.socials.linkedin}</span>}
              </div>
            </div>
          </div>
          <div className="flex gap-3 print:hidden">
            <Button variant="outline" onClick={() => window.print()}>
              <Download className="mr-2 h-4 w-4" /> 打印简历
            </Button>
            {profile.email && (
              <Button asChild>
                <a href={`mailto:${profile.email}`}>
                  <Mail className="mr-2 h-4 w-4" /> 联系我
                </a>
              </Button>
            )}
          </div>
        </header>

        {(resume.summary || profile.bio) && (
          <section className="mb-10 print:mb-5">
            <SectionTitle title="个人简介" />
            <p className="leading-8 text-muted-foreground print:text-sm print:leading-6">
              {resume.summary || profile.bio}
            </p>
          </section>
        )}

        <ResumeSection title="工作经历" empty={!visibleExperience.length}>
          {visibleExperience.map((item) => (
            <ResumeTimelineItem key={item.id} item={item} />
          ))}
        </ResumeSection>

        <ResumeSection title="项目经历" empty={!visibleProjects.length}>
          {visibleProjects.map((project) => (
            <ProjectItem key={project.id} project={project} />
          ))}
        </ResumeSection>

        <ResumeSection title="技能特长" empty={!visibleSkills.length}>
          <div className="grid gap-4 md:grid-cols-2 print:grid-cols-2 print:gap-3">
            {visibleSkills.map((skillGroup) => (
              <div key={skillGroup.id} className="rounded-lg border p-5 print:border-0 print:p-0">
                <h3 className="mb-3 font-semibold">{skillGroup.category}</h3>
                <div className="flex flex-wrap gap-2">
                  {skillGroup.items.filter((skill) => skill.trim()).map((skill) => (
                    <Badge key={skill} variant="secondary" className="print:border print:bg-transparent">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ResumeSection>

        <ResumeSection title="教育背景" empty={!visibleEducation.length}>
          {visibleEducation.map((item) => (
            <ResumeTimelineItem key={item.id} item={item} />
          ))}
        </ResumeSection>
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
    item.highlights?.some((highlight) => highlight.trim()) ||
    item.tags?.some((tag) => tag.trim())
  );
}

function hasResumeProjectContent(project: ResumeProject) {
  return Boolean(
    project.title.trim() ||
    project.role?.trim() ||
    project.period?.trim() ||
    project.description.trim() ||
    project.highlights.some((highlight) => highlight.trim()) ||
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
    <section className="mb-10 print:mb-5">
      <SectionTitle title={title} />
      <div className="space-y-7 print:space-y-4">{children}</div>
    </section>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <h2 className="mb-5 flex items-center gap-3 font-display text-2xl font-bold print:mb-3 print:text-lg">
      {title}
      <Separator className="flex-1" />
    </h2>
  );
}

function ResumeTimelineItem({ item }: { item: ResumeItem }) {
  return (
    <article className="grid gap-3 md:grid-cols-[180px_1fr] print:grid-cols-[130px_1fr] print:gap-3">
      <div className="text-sm font-medium text-muted-foreground">
        <div>{item.period}</div>
        {item.location && <div className="mt-1 text-xs">{item.location}</div>}
      </div>
      <div>
        <h3 className="text-lg font-bold print:text-base">{item.title}</h3>
        {item.subtitle && <div className="font-medium text-primary">{item.subtitle}</div>}
        {item.description && (
          <p className="mt-2 text-sm leading-7 text-muted-foreground print:leading-6">
            {item.description}
          </p>
        )}
        {item.highlights && item.highlights.length > 0 && (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-7 text-muted-foreground print:leading-6">
            {item.highlights.map((highlight) => (
              <li key={highlight}>{highlight}</li>
            ))}
          </ul>
        )}
        {item.tags && item.tags.length > 0 && <TagList tags={item.tags} />}
      </div>
    </article>
  );
}

function ProjectItem({ project }: { project: ResumeProject }) {
  return (
    <article className="grid gap-3 md:grid-cols-[180px_1fr] print:grid-cols-[130px_1fr] print:gap-3">
      <div className="text-sm font-medium text-muted-foreground">{project.period}</div>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-bold print:text-base">{project.title}</h3>
          {project.showLink && project.link && (
            <a
              href={project.link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary print:text-muted-foreground"
            >
              链接 <ExternalLink className="h-3 w-3 print:hidden" />
            </a>
          )}
        </div>
        {project.role && <div className="font-medium text-primary">{project.role}</div>}
        {project.description && (
          <p className="mt-2 text-sm leading-7 text-muted-foreground print:leading-6">
            {project.description}
          </p>
        )}
        {project.highlights.length > 0 && (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-7 text-muted-foreground print:leading-6">
            {project.highlights.map((highlight) => (
              <li key={highlight}>{highlight}</li>
            ))}
          </ul>
        )}
        {project.tags.length > 0 && <TagList tags={project.tags} />}
      </div>
    </article>
  );
}

function TagList({ tags }: { tags: string[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2 print:gap-1.5">
      {tags.map((tag) => (
        <Badge key={tag} variant="outline" className="print:border print:bg-transparent print:text-xs">
          {tag}
        </Badge>
      ))}
    </div>
  );
}
