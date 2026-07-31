# 个人 Google Ads Keyword Planner 扩展

此扩展让单人自托管的 OpenSEO 直接从 Cloudflare Worker 调用 Google Ads REST
API，提供关键词创意和历史指标。它不替换现有 DataForSEO 功能、不创建数据库表，
也不需要 `google-ads-python` 服务。

## 需要准备的凭据

现有 Worker 变量会被直接复用：

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

请确认该 OAuth 客户端所属的 Google Cloud 项目已启用 Google Ads API。除此之外，
还需准备 Google Ads developer token、具有 `https://www.googleapis.com/auth/adwords`
scope 的离线 refresh token，以及 10 位 Google Ads customer ID。通过经理账户访问
客户账户时，还需提供经理账户的 `loginCustomerId`。

## Cloudflare 配置

新增一个加密的 Worker secret：

```text
PERSONAL_GOOGLE_ADS_CONFIG
```

值是单行 JSON：

```json
{
  "enabled": true,
  "apiVersion": "v25",
  "developerToken": "REPLACE_ME",
  "refreshToken": "REPLACE_ME",
  "customerId": "1234567890",
  "loginCustomerId": "0987654321",
  "currencyCode": "GBP"
}
```

`loginCustomerId` 在不使用经理账户时可以删除。`currencyCode` 必须与 Google Ads
客户账户币种一致；Google Keyword Planner 的响应不携带币种，因此扩展不会自行
猜测。不要把 JSON 写入 Git、普通 Worker variable 或客户端环境变量。

本项目的生产部署使用 Wrangler 和 Cloudflare D1。在项目目录交互式写入 Worker
secret：

```bash
pnpm exec wrangler secret put PERSONAL_GOOGLE_ADS_CONFIG
```

按提示粘贴单行 JSON；不要把 secret 放入 `wrangler.jsonc`。现有
`GOOGLE_CLIENT_ID` 和 `GOOGLE_CLIENT_SECRET` 无需重复放进 JSON。之后继续使用
项目原有的 D1 部署命令：

```bash
pnpm run deploy
```

Google Ads Keyword Planner 不读写数据库，因此不需要 D1 migration 或 schema
变更。`wrangler.jsonc` 中也不需要新增普通 `vars` 条目；Wrangler 会把通过
`secret put` 创建的 secret 作为 Worker runtime binding 提供给扩展。

## 本地开发

本地开发可把三个变量放入已忽略的 `.env.local` 或 `.dev.vars`，不得提交到 Git。

## 使用与故障排查

配置完成后，从项目侧栏打开 **Google Ads Planner**。页面会显示脱敏 customer ID、
项目市场、币种和 API 版本。关键词创意最多接受 10 个 seed；历史指标按 Google
限制顺序批处理。保存操作只保存关键词文本并添加 `source:google-ads` 标签，不把
缺少 provider/currency 来源字段的 Google 指标写入 OpenSEO 现有指标表。

常见问题：

- `Configuration required`：JSON 缺失、字段无效，或现有 OAuth 两个变量为空。
- `UNAUTHENTICATED`：refresh token 失效或 OAuth 客户端不匹配。
- `FORBIDDEN`：developer token、客户账户权限或 Google Ads API access level 不足。
- `RATE_LIMITED`：Keyword Planning 服务按 customer ID 限流，请稍后重试。
- 语言不支持：项目默认语言没有对应的 Google Ads language constant。

将 JSON 中的 `enabled` 设为 `false`，或删除该 secret，即可只停用此扩展而不影响
OpenSEO 其他页面。

官方参考：

- [Google Ads API OAuth 概览](https://developers.google.com/google-ads/api/docs/oauth/overview)
- [GenerateKeywordIdeas REST](https://developers.google.com/google-ads/api/rest/reference/rest/v25/customers/generateKeywordIdeas)
- [GenerateKeywordHistoricalMetrics REST](https://developers.google.com/google-ads/api/rest/reference/rest/v25/customers/generateKeywordHistoricalMetrics)
- [Keyword Planning 限额](https://developers.google.com/google-ads/api/docs/best-practices/quotas)
