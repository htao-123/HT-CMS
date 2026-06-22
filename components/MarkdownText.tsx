import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

interface MarkdownTextProps {
  content: string;
  className?: string;
}

export function MarkdownText({ content, className }: MarkdownTextProps) {
  return (
    <div className={cn("space-y-1 text-sm leading-6", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="my-1 leading-6">{children}</p>,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-4">
              {children}
            </a>
          ),
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          code: ({ children }) => (
            <code className="rounded bg-current/10 px-1 py-0.5 text-[0.92em] font-medium">
              {children}
            </code>
          ),
          ul: ({ children }) => <ul className="my-1 list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="my-1 list-decimal space-y-1 pl-5">{children}</ol>,
          li: ({ children }) => <li className="leading-6">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-2 pl-3 text-muted-foreground">
              {children}
            </blockquote>
          ),
          h1: ({ children }) => <h3 className="mt-2 text-base font-bold">{children}</h3>,
          h2: ({ children }) => <h3 className="mt-2 text-base font-bold">{children}</h3>,
          h3: ({ children }) => <h4 className="mt-2 text-sm font-semibold">{children}</h4>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
