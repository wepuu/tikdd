# Work Item 126：Cobalt 多平台能力矩阵验证

## 状态

实施中。基线为 `main@371da812`。本项只建立能力矩阵和资格判定，不启用 Cobalt 生产流量。

## 验证边界

Cobalt 的能力以私有实例认证后的 `GET /` 返回的 `cobalt.services` 为准，不根据官网页面或
第三方列表猜测服务。官方 API 允许 `redirect`、`picker`、`tunnel` 和 `local-processing`；
TikDD 只接受前两类可审计结果，`tunnel` 和 `local-processing` 会让 Cobalt 参与媒体传输或
处理，在当前架构下直接归类为 `proxy-only`。

本轮优先验证已有平台的二级能力：Vimeo、Pinterest、X、TikTok、Facebook、Instagram。
YouTube、xHamster 和已关闭的 OK.ru 不在本项测试范围。运行时额外公布的 Reddit、Loom、VK、
Rutube、Snapchat、Bluesky、Xiaohongshu、SoundCloud 或其他服务只记录为后续候选，不在本项
新增公共平台或 Provider adapter。

## 代码边界

- `packages/providers/src/cobalt-capability-matrix.ts` 负责运行时服务清单解析、服务别名归一化
  和按平台资格判定。
- 证据只包含平台、响应模式、样本数量、交付门槛和脱敏失败码；不得写入源 URL、媒体 URL、
  完整 CDN Host、签名参数、Cookie、Token 或响应正文。
- Cobalt picker 中的照片、音频和普通 GIF 不得被误判为 MP4；只接受视频候选。
- 现有 Cobalt host policy、API、数据库、Admin 和生产配置不变。

## 测试门槛

每个平台最多使用两个公开样本，每条解析请求一次、15 秒超时、请求间隔至少 10 秒，不自动
重试。候选媒体必须通过 HTTPS、公共 DNS、Host policy、最多三次重定向和 1 KiB Range 检查，
并从 NL、本机直连和本机 v2rayN 出口复核。浏览器交付必须是附件下载或审计通过的 CORS 保存；
Provider 页面接力、NL 绑定、HLS-only、音视频分离和 Cobalt tunnel 均不合格。

资格状态：

- `qualified-secondary`：两个样本完整通过，可进入后续二级路由工作项；
- `resolved-candidate` / `resolved-conditional`：解析成功但证据不完整；
- `proxy-only`：只有 tunnel/local-processing；
- `delivery-blocked`：跨出口、浏览器交付或源 IP 边界失败；
- `no-media`：无可规范化视频；
- `blocked`：需要登录、Cookie、验证码或浏览器状态；
- `deferred`：429、5xx、超时或临时网络故障。

只有 `qualified-secondary` 才允许后续创建独立的 rollout rule 和版本化 Delivery policy；本项
本身不部署、不改变流量、不加入 sitemap。
