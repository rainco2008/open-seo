# 个人版 Google Ads Keyword Planner 扩展

## 状态

提议中（2026 年 7 月）

## 摘要

为当前 OpenSEO fork 增加一个仅供个人使用的 Google Ads Keyword Planner
页面，由现有 Cloudflare Worker 直接调用 Google Ads REST API。扩展与
OpenSEO 内置的 DataForSEO 关键词数据源保持隔离，使以后合并
`upstream/every-app/open-seo` 时，只需要维护少量、明确的桥接点。

第一版有意限制为“单操作者、单 Google Ads 账户”：

- 复用 Worker 已配置的 `GOOGLE_CLIENT_ID` 和 `GOOGLE_CLIENT_SECRET`；
- Google Ads 专属凭据使用部署端 secret，不实现用户侧 OAuth 连接管理；
- 不新增数据库表或迁移；
- 不修改现有 DataForSEO provider、关键词研究路由、缓存或计费代码；
- Google Ads 结果在独立页面展示和导出；
- 可以选择把关键词文本传给现有“保存关键词”服务，但不把 Google Ads
  指标写入现有指标表。

这样既符合项目当前 TypeScript/Cloudflare Workers 运行方式，也能把此
fork 的长期差异控制在较小范围内。

## 目标

1. 使用关键词 seed 和可选 URL 调用
   `KeywordPlanIdeaService.GenerateKeywordIdeas`。
2. 对给定关键词列表调用
   `KeywordPlanIdeaService.GenerateKeywordHistoricalMetrics`。
3. 支持地区、语言、Google Search 网络、分页、月搜索量、广告竞争度、
   平均 CPC 和页首出价区间。
4. 所有凭据和 Google API 调用仅发生在服务端。
5. 无需数据库回滚即可禁用或删除该功能。
6. 把未来合并 upstream 时的冲突限制在少数已记录的桥接文件中。

## 非目标

- 替换 OpenSEO 现有 `research_keywords` 或 `get_keyword_metrics` 行为。
- 重命名现有代表 DataForSEO 来源的 `google_ads` 标识。
- 多用户 OAuth、每项目选择不同 Google Ads 账户或多 Ads 客户账户。
- 创建广告系列、广告组、广告或预测方案。
- 为 Google Ads API 请求扣除 Autumn credits。
- 在第一版把 Google Ads 直连指标持久化到 `keyword_metrics`。

## 为什么使用 REST 而不是 `google-ads-python`

OpenSEO 是运行在 Cloudflare Worker 中的 TypeScript 应用。Google Ads REST
可以直接使用现有 `fetch` 运行时；`google-ads-python` 则需要额外部署
Python/gRPC 服务、内部服务鉴权、独立发布周期和新的凭据边界，而不会提供
更多 Keyword Planner 数据。

扩展必须显式配置 Google Ads API 版本。本方案编写时 v25 为当前版本，
但版本值放在配置中，以便升级 API 时无需改动领域代码。

官方参考：

- Keyword Ideas：<https://developers.google.com/google-ads/api/docs/keyword-planning/generate-keyword-ideas>
- Historical Metrics：<https://developers.google.com/google-ads/api/docs/keyword-planning/generate-historical-metrics>
- REST 认证与请求头：<https://developers.google.com/google-ads/api/rest/auth>
- 配额：<https://developers.google.com/google-ads/api/docs/best-practices/quotas>
- API 版本生命周期：<https://developers.google.com/google-ads/api/docs/sunset-dates>

## 隔离策略

### 边界原则

所有功能实现集中在：

```text
src/extensions/personal-google-ads/
```

扩展目录内的代码可以依赖一个小型 OpenSEO 适配层，但 OpenSEO 现有功能
不能反向导入扩展内部实现。第一版不得修改以下 upstream 所有的区域：

- `src/server/lib/dataforseo/**`
- `src/server/features/keywords/services/research/**`
- `src/shared/keyword-locations.ts`
- `src/db/**`
- `drizzle/**` 和 `drizzle-pg/**`
- 现有 MCP 工具的输入输出协议

### 允许修改的 upstream 桥接点

初始实现只允许在以下文件做小型且带注释标记的修改：

| 文件                             | 用途                          | 预期改动                          |
| -------------------------------- | ----------------------------- | --------------------------------- |
| `src/client/navigation/items.ts` | 显示个人 Keyword Planner 页面 | 一个 import 和一个导航项或 spread |
| `src/server/mcp/server.ts`       | 仅在第四阶段注册个人 MCP 工具 | 一个 import 和一次调用            |

TanStack route 使用新文件，不修改现有 route。正式部署复用项目现有 Wrangler 和
Cloudflare D1 路径；Google Ads 扩展不读写数据库。

每个桥接修改都使用以下标记：

```ts
// PERSONAL_GOOGLE_ADS_EXTENSION
```

增加一个小型检查脚本，在合并 upstream 后确认这些标记和 import 没有被
意外删除。

### OpenSEO 适配层

只有以下文件可以代表扩展导入不稳定的 OpenSEO 内部 API：

```text
src/extensions/personal-google-ads/bridge/openseo.ts
```

例如，项目鉴权 middleware 和现有“保存关键词”函数通过这个适配层重新
导出。如果 upstream 移动了相关 API，通常只需要修复此文件和相应桥接点。

## 建议文件布局

```text
src/extensions/personal-google-ads/
  README.md
  config.ts
  schemas.ts
  types.ts
  bridge/
    openseo.ts
  server/
    access-token.ts
    google-ads-rest-client.ts
    google-ads-errors.ts
    market-constants.ts
    keyword-planner-mapper.ts
    KeywordPlannerService.ts
    server-functions.ts
  client/
    GoogleAdsPlannerPage.tsx
    KeywordIdeasForm.tsx
    HistoricalMetricsForm.tsx
    KeywordPlannerResults.tsx
    export-csv.ts
  mcp/
    tools.ts                 # 第四阶段，可选
  __tests__/
    config.test.ts
    access-token.test.ts
    google-ads-rest-client.test.ts
    keyword-planner-mapper.test.ts
    server-functions.test.ts

src/routes/_project/p/$projectId/google-ads-planner.tsx
scripts/check-personal-google-ads-boundaries.mjs
docs/PERSONAL_GOOGLE_ADS.md
```

## 配置与凭据

### 复用现有 OAuth 客户端

Cloudflare Worker 已经配置：

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

本扩展直接复用这两个服务端变量，不再创建或维护第二组 client ID/secret。
OAuth client ID/secret 本身不限定单一 Google API，但需要确认其所属 Google
Cloud 项目已经启用 Google Ads API，并且 OAuth consent screen 可以请求：

```text
https://www.googleapis.com/auth/adwords
```

Google Ads 使用单独生成的离线 refresh token。这个 refresh token 只存入
扩展配置，不覆盖 Better Auth 或 GSC 已保存的 token，因此不会影响现有
Google 登录和 Search Console 集成。

### Google Ads 专属配置

新增一个仅服务端可见的 secret：

```text
PERSONAL_GOOGLE_ADS_CONFIG
```

示例 JSON：

```json
{
  "enabled": true,
  "apiVersion": "v25",
  "developerToken": "...",
  "refreshToken": "...",
  "customerId": "1234567890",
  "loginCustomerId": "0987654321",
  "currencyCode": "GBP"
}
```

其中 `loginCustomerId` 仅在通过经理账户访问 operating customer 时需要。
配置解析时把 customer ID 规范化为纯数字。

完整运行配置由以下三部分组合：

```text
GOOGLE_CLIENT_ID              # 已存在
GOOGLE_CLIENT_SECRET          # 已存在
PERSONAL_GOOGLE_ADS_CONFIG    # 新增
```

整个配置在信任边界使用 Zod 校验。配置缺失或错误时，仅禁用 Google Ads
扩展并显示设置提示，不能导致 Worker 启动失败，也不能影响其他 OpenSEO
页面。

这种设计不需要在 `wrangler.jsonc` 中保存 secret 值；现有
`GOOGLE_CLIENT_ID` 和 `GOOGLE_CLIENT_SECRET` 无需再次修改。

不同部署方式：

- 本地开发：把 `PERSONAL_GOOGLE_ADS_CONFIG` 放入已忽略的 `.env.local`
  或 `.dev.vars`。
- Cloudflare Worker：用 `pnpm exec wrangler secret put
PERSONAL_GOOGLE_ADS_CONFIG` 交互式写入 secret，再沿用 `pnpm run deploy`。

任何 secret 都不得返回给 server function 调用方、进入客户端 bundle、
日志、fixtures、snapshots 或错误消息。

## 服务端架构

遵循项目既有的 server function → service 分层：

```text
TanStack server function
  -> KeywordPlannerService
    -> GoogleAdsRestClient
      -> OAuth access-token helper
        -> Google OAuth / Google Ads REST
```

第一版不持久化扩展自有数据，因此不需要 repository。

### Access token helper

`access-token.ts` 使用现有 `GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET` 和
扩展配置中的 `refreshToken`，向
`https://oauth2.googleapis.com/token` 换取 access token。

可以在模块内存中保留 access token 和过期时间作为优化，但正确性不能依赖
Cloudflare isolate 被复用。token 应在实际过期前稍早刷新；Google Ads 返回
认证失败时只允许强制刷新并重试一次。

### REST client

REST client 统一负责：

- API URL 和版本拼接；
- `Authorization`、`developer-token` 和可选 `login-customer-id` 请求头；
- 使用 `AbortSignal.timeout` 或等效 controller 设置请求超时；
- JSON 解析和 Zod 校验；
- 提取 Google 返回的 `request-id` response header；
- 分页 token；
- 重试分类。

对扩展其他部分只暴露两个窄接口：

```ts
generateKeywordIdeas(input): Promise<KeywordIdeasPage>
generateHistoricalMetrics(input): Promise<HistoricalMetricRow[]>
```

扩展其他模块不得自行构造 Google Ads URL 或请求头。

### 地区和语言常量

不要把 Google criterion ID 加到 upstream 的 `keyword-locations.ts`。
`market-constants.ts` 独立维护 OpenSEO location/language 到 Google Ads
`geoTargetConstants/*` 和 `languageConstants/*` resource name 的显式映射。

未知值应在调用 Google 前返回验证错误。初始版本只支持实际使用的市场，
后续按需扩展独立映射表，不复制或改造 upstream 的完整市场列表。

### 标准化结果

```ts
type PersonalGoogleAdsKeywordRow = {
  keyword: string;
  searchVolume: number | null;
  monthlySearches: Array<{
    year: number;
    month: number;
    searchVolume: number;
  }>;
  competition: number | null; // competition_index / 100
  competitionLevel: "LOW" | "MEDIUM" | "HIGH" | "UNSPECIFIED" | null;
  averageCpc: number | null; // micros 转换为账户币种单位
  lowTopOfPageBid: number | null;
  highTopOfPageBid: number | null;
  closeVariants: string[];
  currencyCode: string;
  source: "google_ads_api";
};
```

不伪造 Keyword Difficulty 或 SEO Intent。UI 必须明确说明 competition 是
付费广告竞争度。所有金额字段显示 Google Ads 账户币种，不能默认 USD。

## 请求行为

### 生成 Keyword Ideas

- 一次 Google 请求接受 1–10 个关键词 seed。
- 接受可选 HTTPS URL。
- 根据输入选择 keyword、URL 或 keyword-and-URL seed 类型。
- 默认 network 为 `GOOGLE_SEARCH`。
- 第一版不包含成人关键词。
- 返回一页结果和 `nextPageToken`，不自动拉取无限结果集。

### 查询 Historical Metrics

- 接受去重和规范化后的关键词列表。
- 设置应用侧 batch 上限，并按顺序处理每个 batch。
- 保留 Google 返回的 close variants。
- micros 只在 mapper 中转换一次。
- 所有 batch 完成标准化后再排序。

### 限流与重试

Google Keyword Planning 主要方法按 customer ID 限制为 1 QPS。个人版本暂不
增加 Durable Object binding，而采用：

- 不使用 `Promise.all` 并行发送 Planner 请求；
- 请求进行时禁止表单重复提交；
- 顺序处理应用侧 batch；
- 对 `RESOURCE_EXHAUSTED`、HTTP 429 和临时 5xx 使用指数退避加 jitter；
- 存在 `Retry-After` 时优先遵守；
- 限制最大重试次数，并只在服务端日志记录 Google request ID。

这对单操作者足够。只有未来同时启用 UI、MCP 或定时任务并允许并发调用时，
才需要按 CID 建立 Durable Object 队列。

### 缓存

不要复用现有 `dataforseo-cache/` namespace。第一版可以不做持久缓存。如果
以后增加缓存，应在扩展内部实现独立 R2 adapter，使用类似
`personal-google-ads/v1/` 的前缀，并把 API 版本、customer ID、市场、
network、seed、URL、日期选项和 page token 纳入 cache key。

## UI

新增独立项目路由：

```text
/p/$projectId/google-ads-planner
```

不要在现有 Keyword Research 页面加入 provider 切换。新页面包含：

1. 配置状态提示：已配置、已禁用或配置错误。
2. Ideas tab：关键词和 URL seed。
3. Historical Metrics tab：粘贴关键词列表。
4. 带来源和币种标签的结果表格。
5. 客户端生成 CSV。
6. 可选的“保存所选关键词”操作。

保存操作只通过现有 OpenSEO 边界提交关键词文本和可选 tags。第一版不得提交
Google metrics，因为现有 `keyword_metrics` 表不保存 provider、currency
或 Google Ads connection provenance。

建议 tag：

```text
source:google-ads
```

## MCP 集成

MCP 单独作为后续阶段。如果在这个个人部署中启用，新增两个独立工具，不修改
现有工具协议：

- `google_ads_generate_keyword_ideas`
- `google_ads_get_historical_metrics`

工具 handler 调用同一个 `KeywordPlannerService`，要求正常的 project
authorization，顺序处理 Google 请求，并在输出中明确提供
`source=google_ads_api` 和币种。只有个人配置完整且已启用时才注册工具。

现有 `research_keywords` 和 `get_keyword_metrics` 保持不变，从而保留
upstream 行为并避免数据来源含糊。

## 错误处理

把 Google 错误转换为稳定的扩展错误：

| Google/HTTP 情况            | 用户侧行为                                                |
| --------------------------- | --------------------------------------------------------- |
| 本地配置缺失或无效          | 显示设置说明，不调用 Google                               |
| OAuth `invalid_grant`       | 提示重新生成 Google Ads refresh token                     |
| `UNAUTHENTICATED`           | 强制刷新一次，仍失败则报告凭据错误                        |
| `USER_PERMISSION_DENIED`    | 检查 customer/login-customer ID 和账户权限                |
| Developer token/access 错误 | 检查 developer token 审批和 permissible use               |
| 429 / `RESOURCE_EXHAUSTED`  | 在上限内重试，之后提示稍后再试                            |
| 无效地区、语言或 seed       | 尽可能在调用 API 前返回验证错误                           |
| 其他 Google Ads failure     | UI 显示通用错误；结构化详情和 request ID 只进入服务端日志 |

错误对象不得包含 access token、refresh token、developer token、client
secret 或完整 response headers。

## 测试计划

所有 CI 测试 mock `fetch`，绝不需要真实 Google 凭据。

1. 配置解析：禁用、有效、缺少字段、错误 JSON、customer ID 规范化、错误
   消息不泄露 secret，以及复用现有 Google client 变量。
2. OAuth：成功换取 token、提前刷新、`invalid_grant`、超时和认证失败后的
   单次重试。
3. REST 请求构造：API 版本、customer path、headers、seed oneof、
   geo/language resources、分页，以及异常中不包含 secret。
4. 响应映射：null 字段、enum、逐月搜索量、close variants、competition
   缩放和 micros 转换。
5. Service 行为：去重、顺序 batching、重试上限和 abort 传播。
6. Server function：project authorization 和功能未配置时的行为。
7. UI：fixture 驱动的表单提交、排序、CSV 导出，以及只保存关键词文本。
8. 边界检查：要求的 extension markers 仍存在，禁止目录没有反向导入扩展。
9. 仓库检查：先运行定向 Vitest，再运行 `pnpm ci:check`。

## 实施阶段

### 阶段 0：凭据和 API 验证

- 确认 Google Ads manager account 和 developer token。
- 确认 developer token 能为当前用途访问 Keyword Planning。
- 确认现有 `GOOGLE_CLIENT_ID` 所属 Google Cloud 项目已启用 Google Ads
  API，并允许请求 `adwords` scope。
- 使用现有 `GOOGLE_CLIENT_ID` 和 `GOOGLE_CLIENT_SECRET`，在项目外生成
  独立的离线 Google Ads refresh token。
- 确认 operating customer 和可选 login customer。
- 用一次性本地脚本或 curl 验证 `GenerateKeywordIdeas` 和
  `GenerateKeywordHistoricalMetrics`。

退出条件：无需修改 OpenSEO，即可让两个调用返回真实数据。

### 阶段 1：隔离的服务端核心

- 在扩展目录增加 config schema、token helper、REST client、market map、
  response schemas、mapper、service 和单元测试。
- 增加 `PERSONAL_GOOGLE_ADS_CONFIG` Wrangler secret 配置文档。

退出条件：mock 测试通过，本地 server function 可以完成两个真实调用。

### 阶段 2：独立 UI

- 增加新 route 和扩展页面。
- 增加最小导航桥接。
- 增加 fixture 驱动的 UI 测试和 CSV 导出。

退出条件：功能正常工作，现有 Keyword Research 无行为变化。

### 阶段 3：保存关键词桥接

- 通过 `bridge/openseo.ts` 增加选择和保存关键词文本。
- 不保存 Google metrics。

退出条件：所选关键词无需 schema migration 即可出现在 OpenSEO Saved
Keywords 中。

### 阶段 4：可选的个人 MCP 工具

- 增加独立工具和一个 MCP 注册桥接。
- 增加顺序调用和 output schema 测试。

退出条件：现有 MCP 工具 snapshots 和 contracts 保持不变。

### 延后阶段：持久化 Google 指标或多账户 OAuth

这需要新的 ADR 和数据库设计。至少要保存 provider、currency、source
connection 和 account provenance，并为 SQLite/Postgres 同时提供 schema
和 migration。不得在第一版中隐式扩大到这一范围。

## 验收标准

- 删除或禁用 `PERSONAL_GOOGLE_ADS_CONFIG` 时，只禁用扩展。
- 现有 DataForSEO 关键词研究、Saved Keywords、Rank Tracking、计费、GSC
  和 MCP 行为不变。
- 不需要数据库 migration。
- Google secret 不出现在客户端 bundle、日志、snapshot 或 Git 中。
- Keyword Ideas 和 Historical Metrics 使用正确的市场范围和币种标签。
- Planner 请求顺序执行并正确处理 1 QPS/CID 限制。
- `pnpm ci:check` 和扩展测试通过。
- 边界检查脚本能识别 upstream merge 后丢失的桥接。

## Fork 维护流程

把扩展改动保持为小型、用途单一的 commits，例如：

```text
personal/google-ads: add isolated REST client
personal/google-ads: add planner route and UI
personal/google-ads: add saved-keyword bridge
personal/google-ads: register optional MCP tools
```

同步 upstream 时：

1. Fetch 并 merge `upstream/main`，不要 squash 个人扩展 commits。
2. 只解决已记录的桥接点冲突；扩展目录内的新文件通常不应冲突。
3. 运行 `node scripts/check-personal-google-ads-boundaries.mjs`。
4. 运行扩展测试和 `pnpm ci:check`。
5. 先在不提供 secret 的状态做 smoke test，再测试完整配置状态。

建议本地启用 Git `rerere`，使少数桥接文件中重复出现的冲突可以复用历史
解决结果。不要把 upstream 关键词模块复制进扩展；应通过小型 bridge 依赖，
或保持功能独立，否则 upstream 的安全修复和 bugfix 会无声分叉。

## 回滚

删除或把 `PERSONAL_GOOGLE_ADS_CONFIG.enabled` 设置为 `false`，即可立即完成功能
回滚。代码回滚只需删除新 route、扩展目录、导航桥接和可选 MCP 注册。由于
第一版不创建表，也不把 Google metrics 写入现有表，因此无需迁移或清理数据。
