# Work Item 82 — SaveVideo、VidDown、DownBot 多平台技术资格验证

## 范围

基线为 `main@8964fc1`。本项只记录从 NL VPS 做出的协议级资格证据，不创建 Provider adapter、Delivery Host Policy、环境门禁、rollout rule、数据库迁移或生产部署。所有主动请求均按单平台一次、10 秒超时、无自动重试的预算执行；不使用登录、用户 Cookie、验证码、Provider 页面接力或完整媒体下载。

候选平台矩阵：

| Provider | 宣称/被动平台 | Lab 端点结论 | 本批状态 |
| --- | --- | --- | --- |
| `savevideo-me` | Dailymotion、Facebook、Vimeo、X、Instagram、TikTok、Reddit、Rumble | 匿名页面表单为 `POST /en/get/`；此前一次 NL 请求返回 HTML 错误，但用户报告网页端成功，形成环境/流程差异 | `reachable` / `evaluating` |
| `viddown-net` | Instagram、Facebook、X、TikTok、Vimeo | 页面可访问；首方脚本确认 API Host `api.viddown.net` 和 Vimeo `POST /vimeo/v1/getLoaderList`；页面会话为短期匿名 HttpOnly JWT；用户报告网页端成功 | `reachable` / `evaluating` |
| `downbot-app` | YouTube、TikTok、Facebook、Instagram、Vimeo、X | 首方脚本确认 `POST https://api.downbot.app/api/download/request` 与状态查询路径；此前主动请求未取得媒体，用户报告网页端成功 | `reachable` / `evaluating` |

## 判定

- 用户的网页端成功结果证明三家服务具备实际使用能力，但没有提供可提交的脱敏协议 fixture，因此只能记录为 `evaluating`，不能直接转换成 TikDD 服务端成功证据。
- SaveVideo 的一次 NL 错误与用户成功结果冲突，不能继续作为确定性 `no-media`；需要用用户成功的同一平台/样本从 NL 复现。
- VidDown 和 DownBot 仍缺少 TikDD 服务端媒体结果；三家均保持 deferred，不能据此进入生产路由。
- 这三家候选均未产生可提交的成功媒体 fixture，也未改变现有 X、Instagram、TikTok、Facebook、Pinterest、Admin 或 calibration 状态。

## Lab 变更

`provider:preflight` 现在同时维护候选落点 `CANDIDATES` 和按平台选择的 `ACTIVE_ENDPOINTS`。`resolveActiveEndpoint(providerId, platform)` 对未审阅的平台显式失败，避免把同一 hosted Provider 的页面宣传能力误当成可调用接口。端点映射只保留方法和 API 路径；请求体、Cookie、响应正文、签名参数和媒体 URL 不进入仓库。

## 后续

若未来要推进某个平台，必须用与用户成功相同的平台和样本，从 NL 完成一次匿名请求，补脱敏成功/失败 fixture、媒体 Range/MIME/Host 审计、adapter、版本化 Delivery policy 和浏览器 handoff。当前不增加生产流量；Vimeo 仍等待服务端证据。
