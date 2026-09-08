# OpenSEO

> 面向个人、团队和 AI Agent 的开源 SEO 工作台。

> [!IMPORTANT]
> 本仓库是 **OpenSEO 的本地自托管项目**。默认在本机运行，应用地址为
> `http://localhost:3001`，MCP 地址为 `http://localhost:3001/mcp`。
> `openseo.so` 是上游官方托管服务，Cloudflare 部署只是可选方案，都不是本仓库当前的默认运行环境。

OpenSEO 是一个可自托管的 SEO 数据与工作流平台，定位为 Semrush、Ahrefs 等商业 SEO 套件的开源替代方案。它把关键词研究、排名跟踪、竞争对手分析、反向链接、网站审计、Google Search Console 和 AI 搜索可见性整合在同一个项目空间中，并通过 MCP 将这些能力提供给 Claude Code、Codex、OpenClaw 等 AI Agent。

项目本身免费且开源；SEO 数据主要通过 DataForSEO 获取，相关费用由 DataForSEO 按用量收取。本仓库优先支持本地运行，也保留 Docker 和 Cloudflare 部署能力。

## 项目状态

- 当前版本：`0.0.28`（以 `package.json` 为准）
- 当前部署方式：本地自托管
- 当前应用入口：`http://localhost:3001`
- 当前 MCP 入口：`http://localhost:3001/mcp`
- 默认数据库：Cloudflare D1（SQLite）
- 可选数据库：PostgreSQL（通过 Hyperdrive/Alchemy 部署路径）
- 默认外部 SEO 数据源：DataForSEO
- 主要运行环境：Cloudflare Workers；本地开发使用 Vite，Docker 使用 Cloudflare/Vite 预览运行时
- 许可证：[MIT](./LICENSE)

## 核心能力

### SEO 工作流

- 关键词研究：关键词扩展、搜索量、难度、CPC、意图和 SERP 结果
- 已保存关键词：保存、筛选和标签化关键词，供内容规划与排名跟踪复用
- 域名概览：估算自然流量、排名关键词和热门自然页面
- 竞争对手研究：从域名和排名关键词中发现内容机会
- 排名跟踪：按项目、域名、关键词、国家/地区、语言和设备跟踪排名变化
- 反向链接：查看反向链接、引用域名、链接页面、nofollow、丢失和断链等信号
- 网站审计：抓取网站并检查页面级与站点级技术 SEO 问题
- Lighthouse：获取页面性能与 Lighthouse 相关数据
- AI 搜索可见性：分析 AI 搜索中的品牌提及、引用页面和相关提示词
- Google Search Console：接入真实的点击、展示、排名和 URL 检查数据（可选）

### AI 与自动化

- OpenSEO MCP Server：向 AI Agent 提供项目、关键词、SERP、域名、反链、排名跟踪、网站审计和 Search Console 工具
- Agent Skills：提供 `keyword-research`、`keyword-clustering`、`competitive-landscape`、`competitor-analysis`、`link-prospecting` 等可复用技能
- SAM：可选的站内 SEO Agent，需要配置 `OPENROUTER_API_KEY`
- Onboarding Agent：帮助新项目完成定位、市场和 SEO 范围梳理
- Cloudflare Workflows：用于网站审计和定时排名检查等长时间任务
- Durable Objects：用于聊天会话和消息持久化

## 使用方式

### 本地自托管（本仓库的默认方式）

Docker 模式默认使用 `local_noauth`，仅适合本机、私有网络或已经由其他认证层保护的环境。不要直接把它暴露到公网。

前置条件：安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/) 或 Docker Engine + Compose。

```bash
cp .env.example .env
# 编辑 .env，至少设置 DATAFORSEO_API_KEY
docker compose up -d
```

默认访问地址为 `http://localhost:3001`。常用操作：

```bash
docker compose logs -f open-seo
docker compose pull && docker compose up -d
docker compose down
```

如需使用指定镜像版本，在 `.env` 中设置 `OPEN_SEO_IMAGE`。详细说明见 [`docs/SELF_HOSTING_DOCKER.md`](./docs/SELF_HOSTING_DOCKER.md)。

### 上游官方托管版

官方提供的托管服务是 [openseo.so](https://openseo.so)。它与本仓库在本机运行的实例相互独立。

### Cloudflare 自托管

Cloudflare 部署适合需要公网访问、多用户和团队协作的场景。部署资源包括 Worker、D1、KV、R2、Durable Objects 和 Workflows；生产/预览资源由 Alchemy 管理，普通本地开发和 Docker 使用根目录的 `wrangler.jsonc`。

可以使用一键部署按钮：

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/rainco2008/open-seo)

部署后需要在 Cloudflare 中启用 Access，并设置 `TEAM_DOMAIN`、`POLICY_AUD` 和 `DATAFORSEO_API_KEY`。如果使用 MCP，还要开启 Access Managed OAuth。这是可选的远程部署方式，不是本仓库当前的默认运行环境。详细步骤见 [`docs/SELF_HOSTING_CLOUDFLARE.md`](./docs/SELF_HOSTING_CLOUDFLARE.md)。

## 本地开发

### 环境要求

- Node.js 20 或更高版本（Docker 构建使用 Node.js 22）
- pnpm 10.30.1
- DataForSEO 账号和 API 凭据

安装依赖并初始化本地 D1：

```bash
pnpm install
pnpm run db:migrate:local
cp .env.example .env.local
```

至少填写：

```dotenv
DATAFORSEO_API_KEY=<Base64 编码的 login:password>
```

生成 Base64 凭据示例：

```bash
printf '%s' 'YOUR_LOGIN:YOUR_PASSWORD' | base64
```

启动开发服务器：

```bash
pnpm dev
```

如果需要让 Agent 更容易读取日志，可使用 `pnpm dev:agents`。该命令通过 Portless 启动服务，默认地址为 `http://open-seo.localhost:1355`，日志写入 `.logs/dev-server.log`。

本地脚本默认使用 `AUTH_MODE=local_noauth`，会注入 `admin@localhost`，适合开发使用。若要测试 Cloudflare Access 验证，可显式设置 `AUTH_MODE=cloudflare_access`，并提供 `TEAM_DOMAIN` 与 `POLICY_AUD`。

更完整的开发说明见 [`docs/LOCAL_DEVELOPMENT.md`](./docs/LOCAL_DEVELOPMENT.md)，PostgreSQL 本地开发见 [`docs/LOCAL_POSTGRES.md`](./docs/LOCAL_POSTGRES.md)。

## 环境变量

| 变量                   | 必需        | 用途                                            |
| ---------------------- | ----------- | ----------------------------------------------- |
| `DATAFORSEO_API_KEY`   | 是          | DataForSEO 的 Base64 编码 `login:password` 凭据 |
| `PORT`                 | 否          | 本地/Docker 端口，默认 `3001`                   |
| `AUTH_MODE`            | 否          | `cloudflare_access`、`local_noauth` 或 `hosted` |
| `TEAM_DOMAIN`          | Access 模式 | Cloudflare Access Team/JWKS 域名                |
| `POLICY_AUD`           | Access 模式 | Cloudflare Access Application Audience          |
| `OPENROUTER_API_KEY`   | AI 功能     | 启用 SAM 等 AI 功能                             |
| `GOOGLE_CLIENT_ID`     | GSC         | Google OAuth Client ID                          |
| `GOOGLE_CLIENT_SECRET` | GSC         | Google OAuth Client Secret                      |
| `BETTER_AUTH_SECRET`   | GSC/Hosted  | 加密 OAuth Token；至少 32 个字符                |
| `BETTER_AUTH_URL`      | Hosted      | Better Auth 的应用 URL                          |
| `ALLOWED_HOST`         | Docker 反代 | 允许的反向代理主机名                            |

完整模板见 [`.env.example`](./.env.example)、[`.env.preview.example`](./.env.preview.example) 和 [`.env.production.example`](./.env.production.example)。不要把包含真实密钥的环境文件提交到 Git。

## 生产环境配置页索引

生产环境配置不要只看根目录的环境变量模板。下面按“仓库配置页 → 部署文档 → 第三方控制台”列出完整入口；真实密钥只应保存到生产环境的 Secrets/Variables 中，不要提交到 Git。

### 仓库内配置页

| 页面/文件                                                          | 作用                                                                                         |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| [`.env.production.example`](./.env.production.example)             | 生产 Alchemy/PostgreSQL 部署的变量模板；复制为本地未提交的 `.env.production` 后填写          |
| [`alchemy.run.ts`](./alchemy.run.ts)                               | 生产与自托管 Alchemy 资源定义、Worker、D1/KV/R2、Hyperdrive、Workflows 和 Durable Objects    |
| [`alchemy.access.ts`](./alchemy.access.ts)                         | Cloudflare Access 相关资源和访问边界配置                                                     |
| [`alchemy.preview-access.run.ts`](./alchemy.preview-access.run.ts) | 预览环境共享 Access 边界；生产配置索引中保留此入口，便于区分预览与生产资源                   |
| [`wrangler.jsonc`](./wrangler.jsonc)                               | 本地/Docker 及 Wrangler 部署所需的 Worker bindings、D1、KV、R2、Workflows 和 Durable Objects |
| [`package.json`](./package.json)                                   | 生产部署命令：`pnpm deploy`（D1）和 `pnpm deploy:postgres`（Alchemy + PostgreSQL）           |
| [`drizzle/`](./drizzle/)                                           | D1/SQLite 生产迁移                                                                           |
| [`drizzle-pg/`](./drizzle-pg/)                                     | PostgreSQL 生产迁移                                                                          |

`.env.production.example` 中当前记录的生产变量包括：

| 变量组     | 变量                                                                                            | 用途                                                         |
| ---------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 数据源     | `DATAFORSEO_API_KEY`                                                                            | DataForSEO API 凭据，SEO 数据功能的核心配置                  |
| 数据库     | `DATABASE_PROVIDER`                                                                             | 生产通常设置为 `postgres`；D1 路径使用 `d1`                  |
| Hyperdrive | `HYPERDRIVE_ORIGIN_HOST/PORT/DATABASE/USER/PASSWORD`                                            | PostgreSQL 源数据库连接信息，供 Alchemy 创建/管理 Hyperdrive |
| 认证       | `BETTER_AUTH_SECRET`、`BETTER_AUTH_URL`                                                         | Hosted Better Auth 会话和 OAuth Token 加密/回调地址          |
| Google     | `GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`                                                      | Google Search Console OAuth                                  |
| 邮件       | `LOOPS_API_KEY`、`LOOPS_TRANSACTIONAL_VERIFY_EMAIL_ID`、`LOOPS_TRANSACTIONAL_RESET_PASSWORD_ID` | 注册验证和密码重置邮件                                       |
| 防滥用     | `TURNSTILE_SECRET_KEY`、`TURNSTILE_SITE_KEY`                                                    | Hosted 注册页 Cloudflare Turnstile                           |
| 计费       | `AUTUMN_SECRET_KEY`、`AUTUMN_WEBHOOK_SECRET`                                                    | 订阅、用量额度、充值和 `/api/autumn/webhook`                 |
| 分析       | `POSTHOG_PUBLIC_KEY`、`POSTHOG_HOST`                                                            | 产品分析和事件上报                                           |
| 转化       | `REDDIT_PIXEL_ID`、`REDDIT_CONVERSIONS_ACCESS_TOKEN`                                            | Reddit 转化事件                                              |
| AI         | `OPENROUTER_API_KEY`、`OPENROUTER_MODEL`                                                        | SAM 等站内 AI Agent                                          |

### 生产部署与数据库页面

- [`docs/PREVIEW_DEPLOYMENTS.md`](./docs/PREVIEW_DEPLOYMENTS.md)：生产发布入口、`hosted-prod` stage、Alchemy adoption、生产资源核对和回滚注意事项。
- [`docs/SELF_HOSTING_CLOUDFLARE.md`](./docs/SELF_HOSTING_CLOUDFLARE.md)：Cloudflare Worker、Access、KV、D1、R2、MCP OAuth 和 Worker Secrets。
- [`docs/SELF_HOSTING_GOOGLE_SEARCH_CONSOLE.md`](./docs/SELF_HOSTING_GOOGLE_SEARCH_CONSOLE.md)：生产 GSC OAuth Client、回调地址和加密 Token 配置。
- [`runbooks/d1-to-postgres-simple.md`](./runbooks/d1-to-postgres-simple.md)：生产 D1 切换 PostgreSQL 的简版步骤。
- [`runbooks/d1-to-postgres-detailed.md`](./runbooks/d1-to-postgres-detailed.md)：生产 D1 → PostgreSQL 数据复制、校验、切换和回滚的详细步骤。
- [`docs/MAINTAINERS.md`](./docs/MAINTAINERS.md)：维护者、发布和生产运维约定。

生产 PostgreSQL 发布命令如下。该命令固定使用 Alchemy stage `hosted-prod` 和 `.env.production`，会先执行 PostgreSQL 迁移，再构建并采用现有生产资源：

```bash
cp .env.production.example .env.production
# 填写并检查 .env.production；不要提交该文件
pnpm alchemy login
pnpm deploy:postgres
```

默认 D1 生产部署使用：

```bash
pnpm db:migrate:prod
pnpm build
pnpm exec wrangler deploy
```

首次或高风险生产变更前，应先阅读生产段落、执行 Alchemy dry-run、核对现有 Worker Secrets 与 `.env.production` 的完整变量集合，并确认迁移记录。Alchemy 部署会替换完整 binding/secret 集合，环境文件缺少的可选变量可能会以空值部署，从而静默关闭对应集成。

### 第三方生产控制台页面

| 控制台                | 配置页面                                                           | 生产用途                                                                                          |
| --------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Cloudflare            | [Workers & Pages](https://dash.cloudflare.com/)                    | Worker、Domains & Routes、Variables & Secrets、D1、KV、R2、Hyperdrive、Workflows、Durable Objects |
| Cloudflare Zero Trust | [Access Applications](https://one.dash.cloudflare.com/)            | 生产域名访问策略、JWT、Managed OAuth、允许的成员和 MCP 回调地址                                   |
| DataForSEO            | [API Access](https://app.dataforseo.com/api-access)                | 创建/查看 API 凭据并生成 `DATAFORSEO_API_KEY`                                                     |
| Google Cloud          | [APIs & Services](https://console.cloud.google.com/apis/dashboard) | 启用 Search Console API、OAuth Consent Screen、OAuth Client ID 和生产回调地址                     |
| Google Search Console | [Search Console](https://search.google.com/search-console)         | 验证站点，并授权生产应用读取对应 property                                                         |
| OpenRouter            | [API Keys](https://openrouter.ai/settings/keys)                    | 创建 `OPENROUTER_API_KEY`，启用 SAM                                                               |
| Loops                 | [Loops](https://app.loops.so/)                                     | 配置交易邮件模板、模板 ID 和 `LOOPS_API_KEY`                                                      |
| Autumn                | [Autumn](https://app.useautumn.com/)                               | 配置套餐、额度、充值、Webhook Secret 和生产计费能力                                               |
| PostHog               | [PostHog](https://app.posthog.com/)                                | 获取 `POSTHOG_PUBLIC_KEY`，确认 `POSTHOG_HOST` 和数据采集项目                                     |
| Reddit Ads            | [Reddit Ads](https://ads.reddit.com/)                              | 创建 Pixel、获取转化 API Token，配置 Reddit 转化跟踪                                              |

外部控制台的具体账号、项目、域名和资源 ID 属于部署者的生产数据；README 只记录入口和用途，不记录任何真实值。

## 认证模式

- `cloudflare_access`：验证 `cf-access-jwt-assertion`，适合 Cloudflare 部署。
- `local_noauth`：不做认证并使用本地管理员用户，仅适合受信任的本地环境。
- `hosted`：使用 Better Auth 的邮箱/密码和组织模式，适合托管版部署。

## Google Search Console

GSC 是可选集成。需要创建 Google OAuth Web 应用，启用 Search Console API，并将回调地址设置为：

```text
https://<你的域名>/api/gsc/oauth/callback
```

Docker 本地地址为 `http://localhost:3001/api/gsc/oauth/callback`。配置 `GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET` 和至少 32 字符的 `BETTER_AUTH_SECRET` 后，重启应用并在 Integrations 中连接 Google。详细说明见 [`docs/SELF_HOSTING_GOOGLE_SEARCH_CONSOLE.md`](./docs/SELF_HOSTING_GOOGLE_SEARCH_CONSOLE.md)。

## 架构概览

```text
React + TanStack Router/Start
              │
              ▼
Cloudflare Worker / Vite Server
              │
    Server Function → Service → Repository
       │          │          │
       │          │          └─ D1/SQLite 或 PostgreSQL
       │          └──────────── DataForSEO、GSC、AI、计费
       └────────────────────── MCP、OAuth、Workflows
```

主要技术：

- 前端：React 19、TanStack Router、TanStack Query、TanStack Form、Tailwind CSS 4、DaisyUI
- 服务端：TanStack Start、Vite、Cloudflare Workers
- 数据库：Drizzle ORM、Cloudflare D1/SQLite、PostgreSQL
- 边缘资源：KV、R2、Durable Objects、Cloudflare Workflows
- AI/MCP：AI SDK、OpenRouter、Cloudflare AI Chat、Model Context Protocol SDK、Agents SDK
- 质量工具：Zod、TypeScript、Oxlint、Prettier、Knip、Vitest、Playwright

## 目录结构

```text
src/
├─ client/              React 客户端、页面功能和 UI 组件
├─ server/              Worker 服务端、业务功能、MCP 和 Workflows
├─ db/                  D1/SQLite 与 PostgreSQL Schema、客户端和迁移入口
├─ shared/              前后端共享类型、校验、业务常量和工具
└─ lib/                 认证及跨层基础设施
web/                    openseo.so 营销站、博客和文档页面
badseo/                 独立的 badseo 辅助站点/Worker
drizzle/                D1/SQLite 迁移
drizzle-pg/             PostgreSQL 迁移
e2e/                    Playwright 端到端测试与 fixtures
docs/                   本地开发、自托管、维护和运行文档
specs/                  功能设计与实现规格
runbooks/               数据库迁移和运维操作手册
scripts/                数据修复、成本分析、发布等脚本
```

服务端功能按领域组织，主要包括 `keywords`、`rank-tracking`、`backlinks`、`domain`、`audit`、`lighthouse`、`gsc`、`ai-search`、`sam`、`onboarding` 和 `projects`。新增应用后端功能时，优先遵循 Server Function → Service → Repository 分层。

## MCP

本地运行时，MCP 端点为：

```text
http://localhost:3001/mcp
```

只有在选择 Cloudflare 等远程部署方式时，才使用 `https://<你的 OpenSEO 域名>/mcp`。

MCP 工具可以列出项目、研究关键词、查询 SERP、查看域名概览和反链、读取/保存关键词、读取排名跟踪、运行网站审计，并在配置后读取 Google Search Console 数据。使用 Cloudflare 自托管时，先在 Access 应用中启用 Managed OAuth，再在 Agent 客户端中连接上述地址。

Agent Skills 安装说明见 [OpenSEO Skills 文档](https://openseo.so/docs/skills/setup)，仓库内的技能说明位于 `.agents/skills/`。

## 常用命令

| 命令                    | 作用                                   |
| ----------------------- | -------------------------------------- |
| `pnpm dev`              | 启动本地开发服务器                     |
| `pnpm dev:agents`       | 启动带固定日志文件的开发服务器         |
| `pnpm build`            | 构建并执行 TypeScript 检查             |
| `pnpm test`             | 运行 Vitest 单元/集成测试              |
| `pnpm test:e2e`         | 运行 Playwright 端到端测试             |
| `pnpm lint`             | 运行 Oxlint                            |
| `pnpm format:check`     | 检查 Prettier 格式                     |
| `pnpm types:check`      | 执行 TypeScript 类型检查               |
| `pnpm ci:check`         | 执行格式、Knip、类型和 lint 检查       |
| `pnpm db:generate`      | 生成 D1 与 PostgreSQL 迁移             |
| `pnpm db:migrate:local` | 应用本地 D1 迁移                       |
| `pnpm db:migrate:pg`    | 应用 PostgreSQL 迁移                   |
| `pnpm cf-typegen`       | 根据 Wrangler 配置生成 Cloudflare 类型 |
| `pnpm deploy`           | 迁移生产 D1、构建并部署 Worker         |

提交代码前建议至少运行：

```bash
pnpm ci:check
pnpm test
```

## 数据与成本

OpenSEO 应用代码可免费使用，但 DataForSEO 是独立的按量计费服务。API 成本取决于查询类型、结果数量、SERP 深度、抓取范围和是否重复打开详情。部署前请查看 [DataForSEO 定价](https://dataforseo.com/pricing) 并设置预算。

OpenSEO 会缓存部分 DataForSEO 响应；Cloudflare 部署建议为 R2 的 `dataforseo-cache/` 配置生命周期规则，避免缓存对象无限累积。

## 路线图

当前重点方向包括：

- 更完善、可定时运行的网站审计
- 面向客户的自定义报告
- Local SEO
- 更深入的站内 AI Agent

路线图会根据实际使用反馈调整。欢迎通过 [GitHub Issues](https://github.com/rainco2008/open-seo/issues)、[Discord](https://discord.gg/c9uGs3cFXr) 或邮件 `ben@openseo.so` 提交建议。

## 贡献指南

欢迎提交 Bug、UX 改进、文档更新和新功能：

1. 先搜索已有 Issue、规格和文档。
2. 对较大功能先提交 Issue 或设计说明，明确范围和验收标准。
3. 保持改动聚焦，遵循现有 TypeScript、TanStack、Drizzle 和 Cloudflare 约定。
4. 运行 `pnpm ci:check` 及相关测试。
5. 提交 Pull Request，并说明变更、验证方式、迁移影响和配置影响。

维护者相关流程见 [`docs/MAINTAINERS.md`](./docs/MAINTAINERS.md)。

## 相关文档

- [`docs/LOCAL_DEVELOPMENT.md`](./docs/LOCAL_DEVELOPMENT.md)：本地开发
- [`docs/LOCAL_POSTGRES.md`](./docs/LOCAL_POSTGRES.md)：本地 PostgreSQL
- [`docs/SELF_HOSTING_DOCKER.md`](./docs/SELF_HOSTING_DOCKER.md)：Docker 自托管
- [`docs/SELF_HOSTING_CLOUDFLARE.md`](./docs/SELF_HOSTING_CLOUDFLARE.md)：Cloudflare 自托管
- [`docs/SELF_HOSTING_GOOGLE_SEARCH_CONSOLE.md`](./docs/SELF_HOSTING_GOOGLE_SEARCH_CONSOLE.md)：GSC 配置
- [`docs/PREVIEW_DEPLOYMENTS.md`](./docs/PREVIEW_DEPLOYMENTS.md)：预览部署
- [`runbooks/`](./runbooks/)：运维与数据库操作手册
- [`specs/`](./specs/)：功能规格与设计记录

## 社区与链接

- 托管版：[openseo.so](https://openseo.so)
- GitHub：[rainco2008/open-seo](https://github.com/rainco2008/open-seo)
- Discord：[加入社区](https://discord.gg/c9uGs3cFXr)
- X：[关注项目更新](https://x.com/bensenescu)
