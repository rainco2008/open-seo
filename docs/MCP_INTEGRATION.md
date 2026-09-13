# OpenSEO MCP 接入手册

本文面向需要在自己的应用、Agent 或自动化任务中接入 OpenSEO MCP 的开发者。

## 1. 服务地址

托管服务的 MCP HTTP endpoint：

```text
https://openseo.steer.workers.dev/mcp
```

上面是本项目当前生产 Worker 的 MCP 地址。官方 OpenSEO 托管服务使用 `https://app.openseo.so/mcp`，两者不是同一个部署；接入本项目时请使用本项目地址，并以它返回的 OAuth 元数据和 `tools/list` 为准。

传输层使用 MCP 的 Streamable HTTP。客户端应发送 JSON-RPC 请求，并带上：

```http
Content-Type: application/json
Accept: application/json, text/event-stream
```

## 2. 认证方式

### OAuth（交互式客户端）

桌面客户端或 CLI 客户端应直接添加上述 endpoint，并让客户端完成 OpenSEO 登录、授权和 token 保存。不要在代码仓库中保存 OAuth access token 或 refresh token。

本项目当前生产环境由 Cloudflare Access 保护（`AUTH_MODE=cloudflare_access`）。管理员必须先在保护该 Worker 的 Access Application 中开启 **Managed OAuth**，并允许 MCP 客户端使用的 localhost/loopback 回调地址；否则 MCP 客户端即使能打开网页，也不能连接工具。网页登录会话不会自动授权另一个 MCP 客户端。

### API key（服务端、CI、无人值守任务）

API key 仅适用于启用了 OpenSEO 自有认证的 `AUTH_MODE=hosted` 部署。在 OpenSEO 的 Settings → API keys 创建个人 API key，并通过环境变量注入。请求使用：

```http
Authorization: Bearer oseo_YOUR_KEY
```

也支持：

```http
x-api-key: oseo_YOUR_KEY
```

API key 代表创建它的用户执行操作，应按生产密钥管理规范保存和轮换。

本项目当前的 Cloudflare Access 生产实例不能用 API key 绕过 Access 登录；请使用上面的 Managed OAuth 流程。`local_noauth` 只适合受信任的本地或私有网络，不应暴露到公网。

## 3. 最小接入流程

推荐所有客户端按以下顺序工作：

1. 建立 MCP HTTP 客户端连接。
2. 调用 `tools/list`，读取当前服务实际暴露的工具和 JSON Schema；不要硬编码完整工具清单。
3. 调用 `list_projects` 获取用户可访问的项目。
4. 如果没有合适项目，再调用 `create_project`。保存返回的 `id`。
5. 在需要项目范围的工具参数中传入该 `id` 作为 `projectId`。
6. 根据工具描述判断是否消耗额度、是否可能返回 `taskId`，并在返回排队任务时按说明恢复任务。

大多数 SEO 数据工具都需要 `projectId`。服务端会再次校验项目是否属于当前账号，不能用它访问其他账号的项目。

## 4. 原始 HTTP 示例

下面示例适合调试或实现一个很薄的 MCP 适配层。生产代码建议使用对应语言的 MCP SDK，以便正确处理会话、流式响应和 JSON-RPC 错误。

### 列出工具

PowerShell：

```powershell
$headers = @{
  Authorization = "Bearer $env:OPENSEO_API_KEY"
  "Content-Type" = "application/json"
  Accept = "application/json, text/event-stream"
}

$body = @{
  jsonrpc = "2.0"
  id = 1
  method = "tools/list"
} | ConvertTo-Json -Compress

Invoke-RestMethod -Uri "https://openseo.steer.workers.dev/mcp" -Method Post `
  -Headers $headers -Body $body
```

### 调用工具

JSON-RPC 的调用形状如下。具体参数以 `tools/list` 返回的 schema 为准：

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "list_projects",
    "arguments": {}
  }
}
```

调用需要项目的工具时，参数通常类似：

```json
{
  "name": "get_domain_overview",
  "arguments": {
    "projectId": "project_id_from_list_projects"
  }
}
```

不要把上面的示例项目 ID 当作真实 ID 使用。

## 5. MCP SDK 客户端建议

如果使用 TypeScript，优先使用 `@modelcontextprotocol/sdk` 的 Streamable HTTP transport；如果使用 Python、Go 或其他语言，选择该语言的 MCP client SDK。适配层至少应具备：

- 读取 `tools/list` 并根据 schema 生成或校验参数；
- 保留 JSON-RPC request ID，并将错误映射到调用方；
- 正确消费普通 JSON 和 `text/event-stream` 响应；
- 对 `401`、`403`、`429` 和 `5xx` 做可区分处理；
- 对返回的 `taskId` 做持久化，避免网络重试导致重复提交付费任务。

不要仅凭 HTTP 200 判断业务成功；还要检查 JSON-RPC error、工具结果中的 `isError` 和结构化输出。

## 6. 工具和额度注意事项

工具名称、输入字段和返回结构会随服务版本扩展，应以每次连接得到的 `tools/list` 为准。常见能力包括：

- 关键词、SERP、域名和竞争对手研究；
- 本地商家、Google Business Profile 和 Maps 排名；
- 反向链接和排名追踪；
- Google Search Console、Google Analytics；
- 网站审计：启动审计并读取状态、问题和页面结果；
- 项目上下文和已保存关键词。

执行付费研究前，应先读取工具 description 中的额度说明，并限制关键词数量、结果深度和分页大小。排队工具可能先返回 `taskId`；恢复时使用同一个工具支持的 `taskId`，不要重新提交初始任务。

### 当前稳定版本源码核对清单

当前源码预期注册 46 个工具；以下清单仅用于人工核对，不代表远端 endpoint 的永久完整列表。客户端运行时必须以同一次连接的 `tools/list` 返回结果为准。

项目与上下文：

`whoami`、`list_projects`、`create_project`、`get_project_context`、`update_project_context`、`list_saved_keywords`、`save_keywords`

关键词、SERP 与域名：

`research_keywords`、`get_keyword_metrics`、`get_serp_results`、`find_serp_competitors`、`get_domain_overview`、`get_domain_keyword_suggestions`、`get_ranked_keywords`

反向链接：

`get_backlinks_overview`、`get_backlinks_profile`

本地 SEO 与 Google Business：

`search_local_businesses`、`get_local_serp_results`、`get_google_business_questions`、`get_business_profile`、`get_business_reviews`、`get_business_updates`、`list_business_categories`、`get_local_rank_grid`

排名追踪：

`create_rank_tracker`、`get_rank_tracker`、`add_rank_tracking_keywords`、`remove_rank_tracking_keywords`、`estimate_rank_tracker_cost`、`run_rank_tracker`

Google Search Console：

`get_search_console_performance`、`inspect_urls`、`get_search_opportunities`

Google Analytics：

`get_google_analytics_organic_landing_pages`、`get_google_analytics_page_performance`、`get_google_analytics_key_events`、`get_google_analytics_organic_overview`、`get_google_analytics_traffic_acquisition`、`get_google_analytics_measurement_health`、`get_google_analytics_ecommerce_performance`、`get_google_analytics_site_search`、`get_google_analytics_audience_breakdown`

网站审计：

`run_site_audit`、`get_audit_status`、`get_audit_issues`、`get_audit_pages`

## 7. 错误处理

建议按下表处理：

| 状态或错误         | 含义                 | 建议                                                         |
| ------------------ | -------------------- | ------------------------------------------------------------ |
| `401`              | 缺少或无效凭据       | 重新 OAuth 授权，或检查 API key 环境变量                     |
| `403`              | 账号或项目无权限     | 重新调用 `list_projects`，确认项目归属和组织成员资格         |
| `429`              | 速率限制             | 遵循 `Retry-After`，使用指数退避，不要立即并发重试           |
| `5xx`              | 服务端或上游暂时失败 | 记录 request ID，有限次数重试；若已有 `taskId`，优先恢复任务 |
| JSON-RPC `error`   | 协议层或参数错误     | 读取 `code` 和 `message`，按工具 schema 修正参数             |
| 工具返回 `isError` | 工具已执行但业务失败 | 展示可读错误，不要把原始堆栈暴露给最终用户                   |

## 8. 接入自检清单

接入完成后，用一个低成本流程验证：

1. `tools/list` 返回工具列表。
2. `list_projects` 成功并返回可用项目。
3. 对一个不消耗额度的项目上下文工具做一次读取。
4. 用一个小参数调用目标研究工具，确认结果结构和额度说明符合预期。
5. 模拟无效 key、无权限项目和超时，确认错误不会泄漏凭据，且可重试或恢复。
6. 检查日志中没有 access token、refresh token 或完整 API key。

本仓库的公开客户端配置示例位于 [`web/content/docs/mcp.md`](../web/content/docs/mcp.md)。
