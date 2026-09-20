# Work Item 82 — SaveVideo、VidDown、DownBot 多平台技术资格验证

## 范围

基线为 `main@8964fc1`。本项只记录从 NL VPS 做出的协议级资格证据，不创建 Provider adapter、Delivery Host Policy、环境门禁、rollout rule、数据库迁移或生产部署。所有主动请求均按单平台一次、10 秒超时、无自动重试的预算执行；不使用登录、用户 Cookie、验证码、Provider 页面接力或完整媒体下载。

候选平台矩阵：

| Provider | 宣称/被动平台 | Lab 端点结论 | 本批状态 |
| --- | --- | --- | --- |
| `savevideo-me` | Dailymotion、Facebook、Vimeo、X、Instagram、TikTok、Reddit、Rumble | 匿名页面表单为 `POST /en/get/`；此前一次 NL 请求返回 HTML 错误，但用户报告网页端成功，形成环境/流程差异 | `reachable` / `evaluating` |
| `viddown-net` | Instagram、Facebook、X、TikTok、Vimeo | 两条用户提供的 Vimeo 样本均从 NL 完成页面令牌、API 请求和匿名会话；均返回 JSON 和 MP4 候选，Range 均返回 `206 video/mp4`，媒体后缀为 `vimeocdn.com` | `resolved` / `evaluating` |
| `downbot-app` | YouTube、TikTok、Facebook、Instagram、Vimeo、X | 首方脚本确认 `POST https://api.downbot.app/api/download/request` 与状态查询路径；此前主动请求未取得媒体，用户报告网页端成功 | `reachable` / `evaluating` |

## 判定

- 用户的网页端成功结果证明三家服务具备实际使用能力；其中 VidDown 已由两条 Vimeo 样本形成可重复的服务端 `resolved` 证据，但仍没有提交解析 fixture，因此不能直接转为生产资格。
- SaveVideo 的一次 NL 错误与用户成功结果冲突，不能继续作为确定性 `no-media`；需要用用户成功的同一平台/样本从 NL 复现。
- DownBot 的正确 JSON 请求从 NL 返回 HTTP 400，未生成任务；仍需解释其浏览器与 NL 的差异。三家均保持 deferred，不能据此进入生产路由。
- 这三家候选均未产生可提交的成功媒体 fixture，也未改变现有 X、Instagram、TikTok、Facebook、Pinterest、Admin 或 calibration 状态。

## Lab 变更

`provider:preflight` 现在同时维护候选落点 `CANDIDATES` 和按平台选择的 `ACTIVE_ENDPOINTS`。`resolveActiveEndpoint(providerId, platform)` 对未审阅的平台显式失败，避免把同一 hosted Provider 的页面宣传能力误当成可调用接口。端点映射只保留方法和 API 路径；请求体、Cookie、响应正文、签名参数和媒体 URL 不进入仓库。

## 后续

若未来要推进 Vimeo，VidDown 是当前唯一的 repeatable-resolved 候选：下一步保存不含 URL/Token/CDN 查询参数的脱敏成功 fixture，开发 adapter、版本化 Delivery policy 并完成浏览器 handoff。SaveVideo 与 DownBot 继续作为待解释的候选；当前不增加生产流量。
