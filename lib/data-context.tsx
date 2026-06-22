"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import type { Project, BlogPost, ResumeData, UserProfile } from "@/types";

interface GitHubUser {
  login: string;
  name: string | null;
  avatar: string;
}

interface Collection {
  id: string;
  name: string;
  description?: string;
}

interface DataContextType {
  profile: UserProfile;
  updateProfile: (profile: UserProfile) => void;
  syncProfile: () => Promise<boolean>;
  pushProfile: (profile?: UserProfile) => Promise<boolean>;

  resume: ResumeData;
  updateResume: (resume: ResumeData) => void;
  syncResume: () => Promise<boolean>;
  pushResume: (resume?: ResumeData) => Promise<boolean>;

  projects: Project[];
  addProject: (project: Project) => void;
  updateProject: (project: Project) => void;
  deleteProject: (id: string) => void;
  syncProjects: () => Promise<boolean>;
  pushProject: (project: Project, oldCollection?: string | null) => Promise<boolean>;

  blogs: BlogPost[];
  addBlog: (blog: BlogPost) => void;
  updateBlog: (blog: BlogPost) => void;
  deleteBlog: (id: string) => void;
  syncBlogs: () => Promise<boolean>;
  pushBlog: (blog: BlogPost, oldCollection?: string | null) => Promise<boolean>;

  blogCollections: Collection[];
  projectCollections: Collection[];
  fetchCollections: (type: "blogs" | "projects") => Promise<Collection[]>;
  createCollection: (type: "blogs" | "projects", id: string, name: string, description?: string) => Promise<boolean>;
  deleteCollection: (type: "blogs" | "projects", id: string) => Promise<boolean>;

  isAuthenticated: boolean;
  githubUser: GitHubUser | null;
  loginWithGithub: () => void;
  logout: () => void;
  checkAuth: () => Promise<void>;
  setAuthenticated: (auth: boolean, user?: GitHubUser) => void;

  isLoading: boolean;
  isSyncing: boolean;
  isPushing: boolean;
  repoConfig: { repo: string | null; branch: string } | null;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

// Default empty profile
const defaultProfile: UserProfile = {
  name: "",
  title: "",
  bio: "",
  email: "",
  avatarUrl: "",
  socials: {
    github: "",
    twitter: "",
    linkedin: "",
  },
};

const defaultResume: ResumeData = {
  summary: "",
  experience: [],
  projects: [],
  education: [],
  skills: [],
  sectionOrder: ["summary", "experience", "projects", "skills", "education"],
};

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [repoConfig, setRepoConfig] = useState<{ repo: string | null; branch: string } | null>(null);

  // Initialize with empty data
  const [profile, setProfile] = useState<UserProfile>(defaultProfile);
  const [resume, setResume] = useState<ResumeData>(defaultResume);
  const [projects, setProjects] = useState<Project[]>([]);
  const [blogs, setBlogs] = useState<BlogPost[]>([]);
  const [blogCollections, setBlogCollections] = useState<Collection[]>([]);
  const [projectCollections, setProjectCollections] = useState<Collection[]>([]);

  const [isAuthenticated, setIsAuthenticatedState] = useState(false);
  const [githubUser, setGithubUser] = useState<GitHubUser | null>(null);

  // Refs to prevent duplicate API calls
  const isFetchingBlogsCollectionsRef = useRef(false);
  const isFetchingProjectsCollectionsRef = useRef(false);

  // Check authentication and repo config on mount
  useEffect(() => {
    checkAuth();
    loadRepoConfig();
  }, []);

  const loadRepoConfig = async () => {
    try {
      const res = await fetch("/api/config");
      if (res.ok) {
        const config = await res.json();
        setRepoConfig(config);
        // If repo is configured, try to sync data
        if (config.repo) {
          await Promise.all([
            syncProfileInternal(),
            syncResumeInternal(),
            syncProjectsInternal(),
            syncBlogsInternal(),
            fetchCollections("blogs"),
            fetchCollections("projects"),
          ]);
        }
      }
    } catch (error) {
      console.error("Failed to load config:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/auth/user");
      const data = await response.json();

      if (data.user) {
        setIsAuthenticatedState(true);
        setGithubUser(data.user);
      } else {
        setIsAuthenticatedState(false);
        setGithubUser(null);
      }
    } catch (error) {
      console.error("Failed to check auth:", error);
      setIsAuthenticatedState(false);
      setGithubUser(null);
    }
  };

  // Sync from GitHub
  const syncProfileInternal = async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/github/profile");
      if (res.ok) {
        const data = await res.json();
        if (data.profile) {
          const nextProfile = {
            ...defaultProfile,
            ...data.profile,
            socials: {
              ...defaultProfile.socials,
              ...(data.profile.socials || {}),
            },
          };
          setProfile(nextProfile);
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  };

  const syncResumeInternal = async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/github/resume");
      if (res.ok) {
        const data = await res.json();
        if (data.resume) {
          setResume({
            ...defaultResume,
            ...data.resume,
          });
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  };

  const syncProjectsInternal = async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/github/projects");
      if (res.ok) {
        const data = await res.json();
        if (data.projects && data.projects.length > 0) {
          setProjects(data.projects);
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  };

  const syncBlogsInternal = async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/github/blogs");
      if (res.ok) {
        const data = await res.json();
        if (data.blogs && data.blogs.length > 0) {
          setBlogs(data.blogs);
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  };

  const syncProfile = async (): Promise<boolean> => {
    setIsSyncing(true);
    try {
      const result = await syncProfileInternal();
      return result;
    } finally {
      setIsSyncing(false);
    }
  };

  const syncResume = async (): Promise<boolean> => {
    setIsSyncing(true);
    try {
      const result = await syncResumeInternal();
      return result;
    } finally {
      setIsSyncing(false);
    }
  };

  const syncProjects = async (): Promise<boolean> => {
    setIsSyncing(true);
    try {
      const result = await syncProjectsInternal();
      return result;
    } finally {
      setIsSyncing(false);
    }
  };

  const syncBlogs = async (): Promise<boolean> => {
    setIsSyncing(true);
    try {
      const result = await syncBlogsInternal();
      return result;
    } finally {
      setIsSyncing(false);
    }
  };

  // Profile actions
  const updateProfile = (newProfile: UserProfile) => {
    setProfile(newProfile);
  };

  const updateResume = (newResume: ResumeData) => {
    setResume(newResume);
  };

  // Project CRUD - now only for UI state, actual data comes from GitHub
  const addProject = (project: Project) => {
    const newProjects = [...projects, project];
    setProjects(newProjects);
  };

  const updateProject = (updatedProject: Project) => {
    const newProjects = projects.map((p) =>
      p.id === updatedProject.id ? updatedProject : p
    );
    setProjects(newProjects);
  };

  const deleteProject = async (id: string) => {
    // Delete from GitHub
    const project = projects.find(p => p.id === id);
    if (!project) return;

    try {
      const res = await fetch("/api/github/push", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "project",
          id: id,
          collection: project.collection,
        }),
      });

      if (res.ok) {
        const newProjects = projects.filter((p) => p.id !== id);
        setProjects(newProjects);
      }
    } catch (error) {
      console.error("Failed to delete from GitHub:", error);
    }
  };

  // Blog CRUD - now only for UI state, actual data comes from GitHub
  const addBlog = (blog: BlogPost) => {
    const newBlogs = [...blogs, blog];
    setBlogs(newBlogs);
  };

  const updateBlog = (updatedBlog: BlogPost) => {
    const newBlogs = blogs.map((b) =>
      b.id === updatedBlog.id ? updatedBlog : b
    );
    setBlogs(newBlogs);
  };

  const deleteBlog = async (id: string) => {
    // Delete from GitHub
    const blog = blogs.find(b => b.id === id);
    if (!blog) return;

    try {
      const res = await fetch("/api/github/push", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "blog",
          id: id,
          collection: blog.collection,
        }),
      });

      if (res.ok) {
        const newBlogs = blogs.filter((b) => b.id !== id);
        setBlogs(newBlogs);
      }
    } catch (error) {
      console.error("Failed to delete from GitHub:", error);
    }
  };

  // Auth actions - Real GitHub OAuth
  const loginWithGithub = () => {
    window.location.href = "/api/auth/github";
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout");
    } catch (error) {
      console.error("Logout error:", error);
    }
    setIsAuthenticatedState(false);
    setGithubUser(null);
  };

  const setAuthenticated = (auth: boolean, user?: GitHubUser) => {
    setIsAuthenticatedState(auth);
    if (user) {
      setGithubUser(user);
    }
  };

  // Push to GitHub
  const pushProfile = async (profileToPush = profile): Promise<boolean> => {
    setIsPushing(true);
    try {
      const res = await fetch("/api/github/push", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "profile",
          id: "profile",
          content: profileToPush,
        }),
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      setIsPushing(false);
    }
  };

  const pushResume = async (resumeToPush = resume): Promise<boolean> => {
    setIsPushing(true);
    try {
      const res = await fetch("/api/github/resume", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume: resumeToPush }),
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      setIsPushing(false);
    }
  };

  const pushProject = async (project: Project, oldCollection?: string | null): Promise<boolean> => {
    setIsPushing(true);
    try {
      const res = await fetch("/api/github/push", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "project",
          id: project.id,
          content: project,
          oldCollection,
        }),
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      setIsPushing(false);
    }
  };

  const pushBlog = async (blog: BlogPost, oldCollection?: string | null): Promise<boolean> => {
    setIsPushing(true);
    try {
      const res = await fetch("/api/github/push", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "blog",
          id: blog.id,
          content: blog,
          oldCollection,
        }),
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      setIsPushing(false);
    }
  };

  // Collection management
  const fetchCollections = async (type: "blogs" | "projects"): Promise<Collection[]> => {
    // Prevent duplicate concurrent requests
    const isFetchingRef = type === "blogs" ? isFetchingBlogsCollectionsRef : isFetchingProjectsCollectionsRef;
    if (isFetchingRef.current) {
      return [];
    }
    isFetchingRef.current = true;

    try {
      const res = await fetch(`/api/github/collections?type=${type}`);
      if (res.ok) {
        const data = await res.json();
        if (type === "blogs") {
          setBlogCollections(data.collections || []);
        } else {
          setProjectCollections(data.collections || []);
        }
        return data.collections || [];
      }
      return [];
    } catch {
      return [];
    } finally {
      isFetchingRef.current = false;
    }
  };

  const createCollection = async (type: "blogs" | "projects", id: string, name: string, description?: string): Promise<boolean> => {
    setIsPushing(true);
    try {
      const res = await fetch("/api/github/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id, name, description }),
      });
      if (res.ok) {
        // Refresh collections after creating
        await fetchCollections(type);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      setIsPushing(false);
    }
  };

  const deleteCollection = async (type: "blogs" | "projects", id: string): Promise<boolean> => {
    setIsPushing(true);
    try {
      const res = await fetch(`/api/github/collections?type=${type}&id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        // Refresh collections after deleting
        await fetchCollections(type);
        // Also sync the items to remove deleted ones from local state
        if (type === "blogs") {
          await syncBlogsInternal();
        } else {
          await syncProjectsInternal();
        }
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      setIsPushing(false);
    }
  };

  return (
    <DataContext.Provider
      value={{
        profile,
        updateProfile,
        syncProfile,
        pushProfile,
        resume,
        updateResume,
        syncResume,
        pushResume,
        projects,
        addProject,
        updateProject,
        deleteProject,
        syncProjects,
        pushProject,
        blogs,
        addBlog,
        updateBlog,
        deleteBlog,
        syncBlogs,
        pushBlog,
        blogCollections,
        projectCollections,
        fetchCollections,
        createCollection,
        deleteCollection,
        isAuthenticated,
        githubUser,
        loginWithGithub,
        logout,
        checkAuth,
        setAuthenticated,
        isLoading,
        isSyncing,
        isPushing,
        repoConfig,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;
}
