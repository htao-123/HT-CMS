"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useData } from "@/lib/data-context";
import { useTheme } from "@/lib/theme-context";
import { cn } from "@/lib/utils";
import { Menu, X, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";

export function Layout({ children }: { children: React.ReactNode }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();
  const { isAuthenticated } = useData();
  const { theme } = useTheme();

  const navItems = [
    { label: "首页", path: "/" },
    { label: "项目", path: "/projects" },
    { label: "博客", path: "/blog" },
    { label: "简历", path: "/resume" },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b print:hidden">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center hover:opacity-80 transition"
          >
            <img
              src={theme === "dark" ? "/logo-dark.svg" : "/logo-light.svg"}
              alt="HT-CMS"
              className="h-9 auto"
            />
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6">
            {navItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                className={cn(
                  "text-sm font-medium transition-colors hover:text-primary",
                  pathname === item.path ? "text-primary" : "text-muted-foreground"
                )}
              >
                {item.label}
              </Link>
            ))}
            {isAuthenticated && (
              <Link
                href="/admin"
                className="text-sm font-medium text-destructive hover:text-destructive/80 flex items-center gap-1"
              >
                <ShieldCheck className="h-4 w-4" /> 管理后台
              </Link>
            )}
            <ThemeToggle />
          </nav>

          {/* Mobile Menu Toggle */}
          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Nav */}
        {isMenuOpen && (
          <div className="md:hidden border-t bg-background/95 backdrop-blur-md p-4 flex flex-col gap-4 animate-in slide-in-from-top-2">
            {navItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                className={cn(
                  "block py-2 text-lg font-medium",
                  pathname === item.path ? "text-primary" : "text-muted-foreground"
                )}
                onClick={() => setIsMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            {isAuthenticated && (
              <Link
                href="/admin"
                className="block py-2 text-lg font-medium text-destructive"
                onClick={() => setIsMenuOpen(false)}
              >
                管理后台
              </Link>
            )}
          </div>
        )}
      </header>

      <main className="flex-1 pt-16 print:pt-0">{children}</main>

      <footer className="border-t py-8 bg-muted/30 print:hidden">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} HT-CMS. Powered by GitHub.</p>
        </div>
      </footer>
    </div>
  );
}
