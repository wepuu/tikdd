# Work Item 82 — SaveVideo、VidDown、DownBot 多平台技术资格验证

## 范围

基线为 `main@8964fc1`。本项只记录从 NL VPS 做出的协议级资格证据，不创建 Provider adapter、Delivery Host Policy、环境门禁、rollout rule、数据库迁移或生产部署。所有主动请求均按单平台一次、10 秒超时、无自动重试的预算执行；不使用登录、用户 Cookie、验证码、Provider 页面接力或完整媒体下载。

候选平台矩阵：

| Provider | 宣称/被动平台 | Lab 端点结论 | 本批状态 |
| --- | --- | --- | --- |
| `savevideo-me` | Dailymotion、Facebook、Vimeo、X、Instagram、TikTok、Reddit、Rumble | 匿名页面表单为 `POST /en/get/`；一次 Vimeo 主动请求返回 HTTP 200 HTML 错误响应，未得到媒体 | Vimeo `no-media`；其余平台未取得主动媒体资格 |
| `viddown-net` | Instagram、Facebook、X、TikTok、Vimeo | 页面可访问；首方脚本确认 API Host `api.viddown.net` 和 Vimeo `POST /vimeo/v1/getLoaderList`；页面会话为短期匿名 HttpOnly JWT，未使用用户凭据 | `reachable` / `not-evaluated` |
| `downbot-app` | YouTube、TikTok、Facebook、Instagram、Vimeo、X | 首方脚本确认 `POST https://api.downbot.app/api/download/request` 与状态查询路径；本次主动请求因远程命令传输格式错误未得到媒体，达到单次预算后停止 | `reachable` / `not-evaluated` |

## 判定

- `savevideo-me` 的 Vimeo 结果为 `no-media`，并记录为一次 canary failure；不进入生产路由。
- `viddown-net` 和 `downbot-app` 仅有被动协议证据，均保持 deferred；不能据此声称可交付或 qualified。
- 这三家候选均未产生可提交的成功媒体 fixture，也未改变现有 X、Instagram、TikTok、Facebook、Pinterest、Admin 或 calibration 状态。

## Lab 变更

`provider:preflight` 现在同时维护候选落点 `CANDIDATES` 和按平台选择的 `ACTIVE_ENDPOINTS`。`resolveActiveEndpoint(providerId, platform)` 对未审阅的平台显式失败，避免把同一 hosted Provider 的页面宣传能力误当成可调用接口。端点映射只保留方法和 API 路径；请求体、Cookie、响应正文、签名参数和媒体 URL 不进入仓库。

## 后续

若未来要推进某个平台，必须单独补真实匿名请求、脱敏成功/失败 fixture、媒体 Range/MIME/Host 审计、adapter、版本化 Delivery policy 和浏览器 handoff。当前不增加生产流量；Vimeo 继续等待下一批候选。
