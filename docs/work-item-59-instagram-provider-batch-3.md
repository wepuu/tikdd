# Work Item 59 — Instagram Provider 技术验证（批次 3）

状态：已完成（证据批次，未创建 Adapter）
基线：`main@979cbb3b4c8530110aaaca0ac5fc02aa5625173`

## 范围与安全边界

本批次从 NL VPS 对六个候选执行一次被动协议检查，并在协议明确可匿名调用时最多提交一次公开 Reel。探测不使用登录、用户 Cookie、Instagram session、localStorage/浏览器 Token、验证码或 Cloudflare 绕过，也不请求 SaveFromIns。响应正文、样本 URL、查询参数、Cookie、Token 和完整 CDN URL 均未写入仓库或日志；一次性探测脚本在本机和 VPS 均已删除。

## 结果

| Provider | 被动检查 | 观察到的协议 | 单次解析 | 判定 |
| --- | --- | --- | --- | --- |
| `embedsocial-jp` | DNS public，TLS/HTTP 200，HTML，无重定向 | 未发现公开表单或客户端 API | 未提交 | `no-media`（无可安全调用的解析协议） |
| `reelsvideo` | DNS public，TLS/HTTP 200，HTML | 表单含 Turnstile/验证码字段 | 未提交 | `blocked`（挑战/浏览器态） |
| `save-free` | DNS public，TLS/HTTP 200，HTML | 表单链含 Turnstile/验证码状态 | 未提交 | `blocked`（挑战/浏览器态） |
| `anonsaver` | DNS public，TLS/HTTP 403，HTML | Cloudflare challenge 标志 | 未提交 | `blocked`（访问挑战） |
| `snap-insta` | DNS public，TLS/HTTP 200，HTML，无重定向 | `POST /en` 表单；客户端观察到 `/api/ajaxSearch`、`/api/json/convert`，其中一个请求指向 `download.i-1-cdn.xyz` | HTTP 200 HTML；资源 1；有效 MP4 0 | `no-media`（匿名响应无法安全规范化 MP4） |
| `dlreel` | DNS public，TLS/HTTP 200，HTML，无重定向 | 未发现公开表单或客户端 API | 未提交 | `no-media`（无可安全调用的解析协议） |

所有请求均使用 10 秒超时、最多三次同源重定向和单次解析提交；媒体候选仅接受 HTTPS、公开 DNS、无凭据/自定义端口，并以 `Range: bytes=0-1023` 验证 `206 video/*`。本批次没有得到可验证 MP4，因此没有候选进入第二 Reel 确认，也没有 `resolved` 或 `qualified` 候选。

## 仓库变更

- `provider:preflight` 增加六个显式候选映射。
- `FREE_PROVIDER_PORTFOLIO` 增加六条离线候选记录：`embedsocial-jp`、`reelsvideo`、`save-free`、`anonsaver`、`snap-insta`、`dlreel`。
- 资格测试覆盖新增的 `technical_no_media` 与 `technical_blocked` 状态。
- 未新增 Provider adapter、Delivery Host policy、环境门禁、rollout rule、数据库迁移或生产配置。

## 结论与后续

本批次关闭为证据性验证。SaveFromIns 继续作为唯一 Instagram 生产 Provider，生产流量和门禁保持不变。若后续候选能在不依赖浏览器态的情况下返回两个样本的可验证媒体，再单独创建适配器与二级路由 Work Item；本批次不因页面可访问而宣称 Provider 可用。
