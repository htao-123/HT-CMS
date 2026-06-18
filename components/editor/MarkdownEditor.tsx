"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Bold,
  Italic,
  Link as LinkIcon,
  Image as ImageIcon,
  Code,
  List,
  ListOrdered,
  Quote,
  Heading1,
  Heading2,
  Minus,
  Undo,
  Redo,
  Eye,
  EyeOff,
  Type,
  Maximize,
  Minimize,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const toolbarButtons = [
  {
    icon: Heading1,
    title: "一级标题",
    before: "# ",
  },
  {
    icon: Heading2,
    title: "二级标题",
    before: "## ",
  },
  {
    icon: Bold,
    title: "粗体",
    before: "**",
    after: "**",
    placeholder: "粗体文本",
  },
  {
    icon: Italic,
    title: "斜体",
    before: "*",
    after: "*",
    placeholder: "斜体文本",
  },
  {
    icon: Type,
    title: "行内代码",
    before: "`",
    after: "`",
    placeholder: "代码",
  },
  {
    icon: Code,
    title: "代码块",
    before: "```\n",
    after: "\n```",
    placeholder: "代码",
  },
  {
    icon: Quote,
    title: "引用",
    before: "> ",
  },
  {
    icon: List,
    title: "无序列表",
    before: "- ",
  },
  {
    icon: ListOrdered,
    title: "有序列表",
    before: "1. ",
  },
  {
    icon: LinkIcon,
    title: "链接",
    before: "[",
    after: "](url)",
    placeholder: "链接文本",
  },
  {
    icon: ImageIcon,
    title: "图片",
    before: "![",
    after: "](url)",
    placeholder: "图片描述",
  },
  {
    icon: Minus,
    title: "分割线",
    before: "\n---\n",
  },
] as const;

export function MarkdownEditor({
  value,
  onChange,
  placeholder = "开始写作...",
}: MarkdownEditorProps) {
  const [showPreview, setShowPreview] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const insertText = (before: string, after: string = "", placeholder: string = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end) || placeholder;
    const newValue =
      value.substring(0, start) + before + selectedText + after + value.substring(end);

    onChange(newValue);

    // Restore cursor position
    setTimeout(() => {
      const newCursorPos = start + before.length + selectedText.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.focus();
    }, 0);
  };

  const handleUndo = () => {
    document.execCommand("undo");
  };

  const handleRedo = () => {
    document.execCommand("redo");
  };

  const handleSyncScroll = () => {
    if (!previewRef.current || !textareaRef.current) return;
    const textarea = textareaRef.current;
    const preview = previewRef.current;
    const percentage = textarea.scrollTop / (textarea.scrollHeight - textarea.clientHeight);
    preview.scrollTop = percentage * (preview.scrollHeight - preview.clientHeight);
  };

  return (
    <div
      className={`border rounded-lg overflow-hidden bg-background w-full ${
        isFullscreen ? "fixed inset-0 z-50 rounded-none" : ""
      }`}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b bg-muted/30 px-2 py-1">
        <div className="flex items-center gap-1 flex-wrap">
          {toolbarButtons.map((btn, index) => (
            <Button
              key={index}
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              title={btn.title}
              onClick={() =>
                insertText(
                  btn.before,
                  "after" in btn ? btn.after : "",
                  "placeholder" in btn ? btn.placeholder : ""
                )
              }
            >
              <btn.icon className="h-4 w-4" />
            </Button>
          ))}
          <div className="w-px h-5 bg-border mx-1" />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            title="撤销"
            onClick={handleUndo}
          >
            <Undo className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            title="重做"
            onClick={handleRedo}
          >
            <Redo className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            title={showPreview ? "隐藏预览" : "显示预览"}
            onClick={() => setShowPreview(!showPreview)}
          >
            {showPreview ? (
              <Eye className="h-4 w-4" />
            ) : (
              <EyeOff className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            title={isFullscreen ? "退出全屏" : "全屏"}
            onClick={() => setIsFullscreen(!isFullscreen)}
          >
            {isFullscreen ? (
              <Minimize className="h-4 w-4" />
            ) : (
              <Maximize className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Editor Area */}
      <div
        className={`flex ${isFullscreen ? "h-[calc(100vh-41px)]" : "h-[60vh]"}`}
      >
        {/* Input Area */}
        <div
          className={`${
            showPreview ? "w-1/2" : "w-full"
          } border-r overflow-hidden`}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onScroll={handleSyncScroll}
            placeholder={placeholder}
            className="w-full h-full p-4 resize-none focus:outline-none font-mono text-sm bg-background"
          />
        </div>

        {/* Preview Area */}
        {showPreview && (
          <div className="w-1/2 overflow-auto bg-muted/20" ref={previewRef}>
            <div className="p-4 prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {value || "*开始写作...*"}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
