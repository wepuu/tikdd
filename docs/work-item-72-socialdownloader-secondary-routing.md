# Work Item 72 — SocialDownloader Facebook 二级路由与交付审计准备

状态：代码与测试已完成，默认关闭；未部署、未创建生产 rollout rule。

基线包含 Work Item 71 的 Provider Lab 证据。SocialDownloader 的 Facebook 主样本和确认样本
均返回一个 Provider 自有 `/api/video` 流式地址，因此本项把它实现为 Facebook 的低优先级
二级适配器，但不把 Provider 自有代理误记为 direct CDN。适配器只接受 `POST /api/download`
返回的 `downloadUrl`/`videoUrl`，并严格限制为 `https://www.socialdownloader.space/api/video`；
相对地址会在内部规范化，公共解析结果不会携带 Provider URL。

路由保持顺序、有界：FDown Isuru 优先，只有其 `provider_unavailable`、超时、挑战、限流等
可回退失败才尝试 SocialDownloader；SocialDownloader 每个任务只调用一次，队列不重放。
显式 422/no-media、私有、删除或不支持内容为终止错误，不继续调用更低优先级 Provider。

新增 `socialdownloader-space-facebook-media-v1` 版本化 Delivery policy，除了精确主机还校验
`/api/video` 路径前缀；Delivery 仍只签发一次性票据并返回受审 302，不经过 NL VPS 中转媒体。

门禁默认关闭：`ENABLE_SOCIALDOWNLOADER_PROVIDER=false`。启用还需要
`SOCIALDOWNLOADER_TERMS_APPROVED=true` 和 `SOCIALDOWNLOADER_DELIVERY_AUDIT_APPROVED=true`。
X/TikTok 尚未有第二样本和浏览器交付审计，继续保持 Lab-only；Instagram、YouTube、Admin、
calibration 和现有生产 Provider 状态不变。

后续发布前已完成一次新增 X 和一次新增 TikTok 协议检查；仍需对 Facebook 流式地址核验
重定向、`video/mp4`、Range、CORS/Content-Disposition、过期时间和桌面/移动端保存行为。
本项未进行生产部署或流量切换。

## NL confirmation probe

2026-09-17 在隔离容器中使用 Provider Lab 执行了 X 和 TikTok 各一条新增 canary。总计 4 次
HTTP 请求（每个解析请求后 1 次 1 KiB Range 检查），无自动重试、未下载完整媒体：

| 平台 | 结果 | HTTP | 有效媒体 | 媒体拓扑 | 媒体 Host 后缀 |
| --- | --- | ---: | ---: | --- | --- |
| X | resolved | 200 | 1 | provider-stream | `socialdownloader.space` |
| TikTok | resolved | 200 | 1 | provider-stream | `socialdownloader.space` |

这两条结果补足了 X/TikTok 的第二条协议样本，但媒体仍是 Provider-stream；在完成浏览器
交付审计前不能扩展 manifest 或标为生产资格。临时脚本、样本和结果已从本机
`.tmp` 与 NL VPS `/tmp/tikdd-wi72-lab` 删除。
