"use client";

import { useData } from "@/lib/data-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminProjects } from "@/components/admin/AdminProjects";
import { AdminBlogs } from "@/components/admin/AdminBlogs";
import { AdminProfile } from "@/components/admin/AdminProfile";
import { AdminGithub } from "@/components/admin/AdminGithub";
import { Github, LayoutDashboard, FolderKanban, FileText, User, LogOut, Settings } from "lucide-react";
import Link from "next/link";

export default function AdminPage() {
  const { isAuthenticated, githubUser, loginWithGithub, logout, isLoading, syncProjects, syncBlogs, syncProfile, syncResume } = useData();

  // Auto-fetch data when switching tabs
  const handleTabChange = (value: string) => {
    if (isAuthenticated) {
      if (value === "projects") {
        syncProjects();
      } else if (value === "blog") {
        syncBlogs();
      } else if (value === "profile") {
        syncProfile();
        syncResume();
      }
    }
  };

  // Handle logout
  const handleLogout = () => {
    logout();
  };

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
              <img src="/logo-icon.svg" alt="HT-CMS" className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold font-display">HT-CMS</h1>
            <p className="text-muted-foreground mt-2">使用 GitHub 账号登录管理后台</p>
          </div>

          <Card className="border-2 shadow-lg">
            <CardContent className="pt-6">
              <Button
                className="w-full h-12 text-base gap-2"
                onClick={loginWithGithub}
              >
                <Github className="w-5 h-5" />
                使用 GitHub 登录
              </Button>

              <div className="mt-4 p-3 rounded-md bg-muted/50 text-xs text-muted-foreground">
                <p className="font-medium mb-1">首次使用？</p>
                <ol className="list-decimal list-inside space-y-1 ml-1">
                  <li>在项目根目录创建 <code className="bg-background px-1 rounded">.env.local</code> 文件</li>
                  <li>配置 GitHub OAuth（见 .env.example）</li>
                  <li>重启开发服务器</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          <div className="mt-6 text-center">
            <Link href="/" className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1">
              <span>←</span> 返回首页
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-md sticky top-0 z-10">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
                <img src="/logo-icon.svg" alt="HT-CMS" className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold font-display">管理后台</h1>
                <p className="text-xs text-muted-foreground">HT-CMS</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {githubUser?.avatar && (
                <img
                  src={githubUser.avatar}
                  alt={githubUser.login}
                  className="w-8 h-8 rounded-full"
                />
              )}
              <span className="text-sm text-muted-foreground">
                {githubUser?.name || githubUser?.login || "Admin"}
              </span>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2">
                <LogOut className="w-4 h-4" />
                退出
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container py-8">
        <Tabs defaultValue="projects" onValueChange={handleTabChange} className="w-full">
          <TabsList className="mb-6 h-auto p-1 bg-background shadow-sm">
            <TabsTrigger value="projects" className="gap-2 data-[state=active]:bg-background">
              <FolderKanban className="w-4 h-4" />
              项目管理
            </TabsTrigger>
            <TabsTrigger value="blog" className="gap-2 data-[state=active]:bg-background">
              <FileText className="w-4 h-4" />
              博客管理
            </TabsTrigger>
            <TabsTrigger value="profile" className="gap-2 data-[state=active]:bg-background">
              <User className="w-4 h-4" />
              个人设置
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2 data-[state=active]:bg-background">
              <Settings className="w-4 h-4" />
              仓库配置
            </TabsTrigger>
          </TabsList>

          <TabsContent value="projects" className="animate-in fade-in-50 slide-in-from-bottom-2">
            <AdminProjects />
          </TabsContent>

          <TabsContent value="blog" className="animate-in fade-in-50 slide-in-from-bottom-2">
            <AdminBlogs />
          </TabsContent>

          <TabsContent value="profile" className="animate-in fade-in-50 slide-in-from-bottom-2">
            <AdminProfile />
          </TabsContent>

          <TabsContent value="settings" className="animate-in fade-in-50 slide-in-from-bottom-2">
            <AdminGithub />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
