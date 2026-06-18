# HT-CMS

一款基于 GitHub 仓库的现代化个人网站内容管理系统，支持项目管理、博客发布和个人简历展示。

![Next.js](https://img.shields.io/badge/Next.js-16.1-black?style=flat&logo=next.js)
![React](https://img.shields.io/badge/React-19.2-blue?style=flat&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=flat&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8?style=flat&logo=tailwind-css)

## 功能特点

### 核心功能
- **项目管理** - 展示个人项目，支持从 GitHub 仓库一键导入
- **博客系统** - 支持分类的文章管理，Markdown 格式渲染
- **个人简历** - 可视化编辑个人资料、工作经历、教育背景和技能
- **GitHub 集成** - 通过 GitHub OAuth 登录，数据存储在你的仓库中

### 特色功能
- **AI 智能简介** - 使用智谱 AI GLM-4-Flash 模型自动生成项目简介（完全免费）
- **合辑管理** - 支持为项目和博客创建分类合集
- **双视图模式** - 提供合辑视图和列表视图两种浏览方式
- **暗黑模式** - 支持亮色/暗色主题切换
- **响应式设计** - 完美适配桌面、平板和移动设备

## 技术栈

| 类别 | 技术 |
|------|------|
| 前端框架 | [Next.js 16](https://nextjs.org/) (App Router) |
| UI 库 | [React 19](https://react.dev/) |
| 语言 | [TypeScript](https://www.typescriptlang.org/) |
| 样式 | [Tailwind CSS 4](https://tailwindcss.com/) |
| 图标 | [Lucide React](https://lucide.dev/) |
| Markdown | [react-markdown](https://github.com/remarkjs/react-markdown) + [remark-gfm](https://github.com/remarkjs/remark-gfm) |
| 动画 | [Framer Motion](https://www.framer.com/motion/) |
| 主题 | [next-themes](https://github.com/pacocoursey/next-themes) |
| 认证 | GitHub OAuth |
| AI | 智谱 AI GLM-4-Flash |

## 环境配置

创建 `.env.local` 文件并配置以下环境变量：

```bash
# GitHub OAuth 配置
# 访问 https://github.com/settings/developers 创建 OAuth App
GITHUB_CLIENT_ID=your_github_client_id_here
GITHUB_CLIENT_SECRET=your_github_client_secret_here

# GitHub Personal Access Token
# 访问 https://github.com/settings/tokens 创建 Fine-grained token，授予 repo 权限
GITHUB_TOKEN=your_github_token_here

# AI 服务配置（可选，用于 GitHub 仓库导入时的智能简介生成）
# 访问 https://open.bigmodel.cn/ 注册并获取 API Key
# GLM-4-Flash 模型完全免费使用
ZHIPU_API_KEY=your_zhipu_api_key_here

# 应用 URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# 公开 GitHub 仓库配置（用于前台展示）
PUBLIC_GITHUB_REPO=yourusername/your-repo
PUBLIC_GITHUB_BRANCH=main
```

## 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/htao-123/HT-CMS.git
cd HT-CMS
```

### 2. 安装依赖

```bash
npm install
# 或
pnpm install
# 或
yarn install
```

### 3. 配置环境变量

复制 `.env.example` 为 `.env.local` 并填写配置：

```bash
cp .env.example .env.local
```

### 4. 启动开发服务器

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000) 查看网站。

### 5. 登录管理后台

访问 [http://localhost:3000/admin](http://localhost:3000/admin) 使用 GitHub 账号登录。

## 项目结构

```
ht-cms/
├── app/                      # Next.js App Router 页面
│   ├── admin/               # 管理后台
│   │   ├── blogs/          # 博客管理
│   │   ├── projects/       # 项目管理
│   │   └── profile/        # 个人资料编辑
│   ├── api/                # API 路由
│   │   ├── auth/           # GitHub OAuth 认证
│   │   ├── github/         # GitHub API 集成
│   │   └── config/         # 配置管理
│   ├── blog/               # 前台博客页面
│   ├── projects/           # 前台项目页面
│   └── resume/             # 前台简历页面
├── components/              # React 组件
│   ├── admin/              # 管理后台组件
│   ├── ui/                 # 基础 UI 组件
│   ├── BlogCard.tsx        # 博客卡片
│   └── ProjectCard.tsx     # 项目卡片
├── lib/                    # 工具函数和上下文
│   └── data-context.tsx    # 全局数据状态管理
└── types/                  # TypeScript 类型定义
```

## 部署指南

### Vercel 部署（推荐）

1. 将代码推送到 GitHub
2. 访问 [Vercel](https://vercel.com/new) 导入项目
3. 在 Vercel 设置中添加环境变量
4. 点击 Deploy

### 其他平台

项目可以部署到任何支持 Next.js 的平台：

- [Netlify](https://www.netlify.com/)
- [Railway](https://railway.app/)
- [Docker](https://www.docker.com/)
- 自有服务器（使用 `npm run build` 和 `npm start`）

## 开发指南

### 可用脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 构建生产版本 |
| `npm start` | 启动生产服务器 |
| `npm run lint` | 运行 ESLint 检查 |

### 添加新功能

1. 在 `app/api/` 中创建新的 API 路由
2. 在 `components/` 中创建可复用组件
3. 在 `lib/data-context.tsx` 中添加全局状态管理
4. 更新 TypeScript 类型定义

## 常见问题

### Q: 如何更换 AI 模型？

A: 修改 `app/api/github/repos/[owner]/[repo]/route.ts` 中的 API 调用，支持 OpenAI、Claude 等其他模型。

### Q: 数据存储在哪里？

A: 所有内容存储在 GitHub 仓库的 `data/` 目录中，格式为 Markdown 文件。

### Q: 支持多用户吗？

A: 目前设计为单用户模式，每个用户使用自己的 GitHub 仓库存储数据。

## 贡献指南

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License

## 链接

- [Next.js 文档](https://nextjs.org/docs)
- [GitHub OAuth 文档](https://docs.github.com/en/developers/apps/building-oauth-apps)
- [智谱 AI 文档](https://open.bigmodel.cn/dev/api)

---

Made with ❤️ using [Next.js](https://nextjs.org/)
