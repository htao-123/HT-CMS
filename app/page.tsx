"use client";

import { Button } from "@/components/ui/button";
import { useData } from "@/lib/data-context";
import Link from "next/link";
import { ProjectCard } from "@/components/ProjectCard";
import { BlogCard } from "@/components/BlogCard";
import { ArrowRight, Github, Linkedin, X } from "lucide-react";

export default function Home() {
  const { profile, projects, blogs } = useData();

  return (
    <div className="flex flex-col gap-20 pb-20">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        {/* Background with gradient overlay */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-background via-background/95 to-primary/5" />

        <div className="container px-4 text-center z-10 animate-in fade-in zoom-in duration-1000">
          <div className="mb-6 inline-block rounded-full bg-secondary px-3 py-1 text-sm font-medium text-secondary-foreground animate-pulse">
            求职中 / Available for hire
          </div>
          {profile.name && (
            <h1 className="text-5xl md:text-7xl font-bold font-display tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/50">
              {profile.name}
            </h1>
          )}
          {profile.title && (
            <h2 className="text-2xl md:text-3xl text-muted-foreground mb-8 font-light">
              {profile.title}
            </h2>
          )}
          {profile.bio && (
            <p className="max-w-2xl mx-auto text-lg text-muted-foreground mb-10 leading-relaxed">
              {profile.bio}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-center gap-4">
            <Button size="lg" className="h-12 px-8 text-base" asChild>
              <Link href="/projects">查看作品</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 px-8 text-base"
              asChild
            >
              <Link href="/resume">查看简历</Link>
            </Button>
          </div>

          <div className="mt-12 flex justify-center gap-6">
            {profile.socials.github && (
              <a
                href={profile.socials.github}
                target="_blank"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                <Github className="h-6 w-6" />
              </a>
            )}
            {profile.socials.linkedin && (
              <a
                href={profile.socials.linkedin}
                target="_blank"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                <Linkedin className="h-6 w-6" />
              </a>
            )}
            {profile.socials.twitter && (
              <a
                href={profile.socials.twitter}
                target="_blank"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                <X className="h-6 w-6" />
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Featured Projects */}
      <section className="container px-4">
        <div className="flex items-center justify-between mb-10">
          <h2 className="text-3xl font-bold font-display">精选项目</h2>
          <Button variant="ghost" className="gap-2" asChild>
            <Link href="/projects">
              全部项目 <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.slice(0, 3).map((project) => (
            <div key={project.id} className="h-full">
              <ProjectCard project={project} />
            </div>
          ))}
        </div>
      </section>

      {/* Latest Thoughts */}
      <section className="container px-4 bg-secondary/30 py-20 rounded-3xl">
        <div className="flex items-center justify-between mb-10">
          <h2 className="text-3xl font-bold font-display">最新文章</h2>
          <Button variant="ghost" className="gap-2" asChild>
            <Link href="/blog">
              阅读博客 <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {blogs.slice(0, 2).map((blog) => (
            <BlogCard key={blog.id} blog={blog} />
          ))}
        </div>
      </section>
    </div>
  );
}
