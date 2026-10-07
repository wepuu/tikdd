# Work Item 152：yt-dlp 批量平台资格验证与分层接入

## 状态

规划阶段。基线为 WI151 发布修正后的 `main`。本项不因 yt-dlp extractor 清单存在就直接
开放生产平台。

## 第一批候选

按匿名可访问性和交付复杂度，优先验证：

1. Streamable
2. Rumble
3. Twitch（仅公开 Clip/VOD）
4. SoundCloud
5. Bilibili
6. OK.ru / Odnoklassniki

Reddit 和 VK 暂缓，直到获得无需登录、Cookie 或浏览器状态即可访问的公开样本。

## 技术资格门槛

- 使用当前生产固定版本的隔离 yt-dlp Runner；不使用账号、Cookie、浏览器配置、验证码或
  手工 Token。
- 每个平台使用两个公开样本，顺序执行；单次解析有明确超时，不自动重试，不保存原始 URL、
  响应正文、完整媒体 URL 或上游请求头。
- 记录 extractor 结果、错误分类、格式数量、缩略图状态和候选交付模式。
- 首选带音视频的渐进式 HTTPS 媒体；HLS 或音视频分离只能进入 artifact 评估，不能假定
  浏览器可以直接下载。
- 必须完成 Delivery ticket、Host/DNS 校验、媒体 Range 检查和一次真实浏览器保存。
- 若媒体 URL 绑定 NL 出口、要求登录态、需要进入 Provider 页面或无法安全建立 Host policy，
  判定为 `blocked` 或 `delivery-blocked`。

## 路由与交付

平台通过资格后才允许实现：

```text
已验证第三方 Provider → 已验证 Cobalt → yt-dlp isolated
```

第三方 Provider 仍是主路由；yt-dlp 仅作为顺序备用。每个平台必须拥有独立 manifest、门禁、
rollout rule 和版本化 Delivery policy。服务器中转只允许平台级、受限的 artifact 或 relay，
不得演变为通用媒体代理。

## 实现批次

只将通过两个样本和浏览器保存验证的平台放入同一个实现 PR，最多三个。实现内容包括平台
Host 规则、spoof 测试、Provider manifest、错误决策测试、路由契约、缩略图边界和生产配置
门禁。没有通过的平台只记录证据，不新增 adapter、页面或 rollout。

## SEO 规则

实验平台页面可以作为 noindex 编辑页面准备；只有平台被明确提升为 `stable` 后，才允许进入
sitemap、hreflang、结构化数据和搜索索引。任务页、结果页和未验证平台保持 noindex。

## 验收

- 资格矩阵包含每个平台的两个样本、交付模式和失败分类。
- 通过平台完成端到端浏览器下载，文件非零且媒体类型正确。
- 第三方主路由和 yt-dlp 备用优先级由 manifest 管理，不在 Web/API 中硬编码。
- 运行 Provider、Delivery、路由、平台 Host、缩略图和脱敏测试，以及 `pnpm check`、生产
  Compose 校验和 `git diff --check`。
- 生产启用按平台逐个进行；任何失败只关闭该平台规则和门禁，不影响既有平台。
