# Work Item 71 — 多平台免费 Provider 技术资格验证

状态：已完成（仅证据，未进入生产）
基线：`main@ee9df99`
执行位置：NL VPS；所有主动请求均使用 Provider Lab 的顺序、10 秒超时、无自动重试和 1 KiB 媒体 Range 限制。

## 范围与保护边界

本批次只验证协议和交付拓扑，不创建 Adapter、Delivery Host Policy、门禁、rollout rule、数据库迁移或生产部署。临时样本、脚本和响应只在内存或临时目录中使用，未写入仓库。输出只保留候选 ID、平台、端点 ID、状态、HTTP 状态、内容类型、耗时、资源计数、媒体后缀、拓扑和脱敏失败码。

判定规则：`resolved` 表示有可验证 MP4；Provider 自有流式地址进一步标为 `resolved-conditional`，不视为生产资格；`deferred` 表示超时、429 或临时网络错误；`no-media` 表示响应无法安全规范化；`blocked` 表示登录、密钥、挑战或其他自动化边界。

## 协议来源

| 候选 | 协议依据 |
| --- | --- |
| SocialDownloader | 公开源码 `Vette1123/social-media-downloader`，commit `05843f09e30f6add79fb3875ea1c1ae9b60b21f6`；匿名 `POST /api/download`，JSON 字段 `url`。托管服务将外部媒体转换为同站 `/api/video` 等流式地址。 |
| Social Media Downloader | 公开源码 `AbdurRaahimm/social-media-downloader`，commit `ec978f633139e55b89731dfd51ad02a538b9f997`；前端调用 RapidAPI `GET /smvd/get/all`，需要 `VITE_API_KEY`，因此没有在本批次发送主动请求。 |
| Gram Grabberz | 公开源码 `riad-azz/instagram-video-downloader`，commit `f23f3497e70f52d227103cff845acc6f585df1cf`；公开 `GET /api/instagram/p/{shortcode}`，媒体下载还依赖其自身 `/api/download-proxy`。 |
| ReelDown | 公开项目描述了 `POST /reels/api/download/`，但 NL 托管站点未建立可复现连接；未继续重试。 |

## NL 主动矩阵结果

样本只以内部引用名记录：`x-primary`、`instagram-primary`、`instagram-confirm`、`tiktok-primary`、`facebook-primary`、`facebook-confirm`、`youtube-primary`、`youtube-confirm`。主样本矩阵实际发出 12 个请求，确认矩阵发出 3 个请求，总计 15 个，低于 55 请求上限。

| Provider | 平台 | 端点 | 主/确认 | 结果 | HTTP | 有效 MP4 | 拓扑 | 失败码 |
| --- | --- | --- | --- | --- | ---: | ---: | --- | --- |
| socialdownloader-space | X | `download-x` | 主样本 | resolved-conditional | 200 | 1 | provider-stream | — |
| socialdownloader-space | Instagram | `download-instagram` | 主样本 | resolved-conditional | 200 | 1 | provider-stream | — |
| socialdownloader-space | Instagram | `download-instagram` | 确认样本 | no-media | 422 | 0 | — | no_valid_media |
| socialdownloader-space | TikTok | `download-tiktok` | 主样本 | resolved-conditional | 200 | 1 | provider-stream | — |
| socialdownloader-space | Facebook | `download-facebook` | 主样本 | resolved-conditional | 200 | 1 | provider-stream | — |
| socialdownloader-space | Facebook | `download-facebook` | 确认样本 | resolved-conditional | 200 | 1 | provider-stream | — |
| socialdownloader-space | YouTube | `download-youtube` | 主样本 | deferred | — | 0 | — | timeout |
| social-media-downloader-eight | Instagram/TikTok/Facebook/YouTube | 未配置 | 主样本 | blocked | — | 0 | — | paid_api_required |
| instagram-video-downloader-vercel | Instagram | `api` | 主样本 | no-media | 404 | 0 | — | non_json_response |
| reelsaver-fun | Instagram | `download` | 主样本 | no-media | 422 | 0 | — | no_valid_media |
| gram-grabberz | Instagram | `instagram-shortcode` | 主样本 | deferred | 429 | 0 | — | rate_limited |
| facebookone | Facebook | 未配置 | 主样本 | blocked | 200 HTML | 0 | — | access_challenge |
| reeldown | Instagram | 未配置 | 主样本 | deferred | — | 0 | — | network_error |

SocialDownloader 的确认 Facebook 两个样本都能返回 MP4，但媒体地址属于 Provider 自有流式路径，因此只能记录为可重复的条件证据；Instagram 第二个样本返回 422，不能记录为可重复成功。X/TikTok 按本批规则仅执行一个样本。YouTube 未达到成功门槛，未执行第二个样本；因此没有把特定 HLS/DASH 格式问题误判为“无任何 MP4”。

## 结论与后续

- 本批没有产生可直接进入 Work Item 72 的 direct-CDN/透明 302 候选。
- SocialDownloader 可作为后续“服务器代理风险评审”的条件候选，但本项不创建代理、不公开其媒体 URL，也不改变现有生产路由。
- Social Media Downloader 因 RapidAPI 密钥依赖阻塞；Gram Grabberz 因 429 延后；ReelSaver、Instagram Video Downloader、FacebookOne 和 ReelDown 没有达到安全 MP4 门槛。
- SaveFromIns、FDown、TikCD、SnapTik、X 及其他现有生产 Provider 状态保持不变；Admin 保持开启，calibration 保持关闭。

本记录不包含样本 URL、响应正文、Cookie、Token、完整 CDN URL 或签名查询参数。
