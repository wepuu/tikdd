# Work Item 111 — SnapYT 交付完整性修复与 YouTube 二级路由

## 结论

SnapYT 的匿名协议仍可访问，但仅凭 `fmt=18/22` 会把 `audio/webm` 误判为 MP4；另一条
公开样本没有合格 combined MP4。本项将它修复为“真实媒体响应通过后才交付”的备用 Provider，
不放宽 Host policy，也不引入媒体中转。

## 实现

- 保留 `redirect_url`、`redirectUrl`、`redirect` 三种结果字段兼容性。
- 对最多两个候选按清晰度顺序执行受限 `Range` 校验，最多读取 1 KiB 后取消响应。
- 只接受 `200/206 + video/mp4 + 非零字节 + Content-Disposition: attachment`。
- 音频、WebM、HTML、空响应、重定向和不合格候选返回脱敏 `invalid_result`。
- NoAdsDL 继续作为 YouTube priority 740 主路由；SnapYT priority 720 为顺序备用。
- 增加 NoAdsDL → SnapYT 路由契约测试、音频误判 fixture、诊断和完整性测试。

## 生产门槛

本项不自动启用任何门禁或 rollout。未来发布时先部署精确 SHA 并备份，再分别验证 NoAdsDL
主路由与 SnapYT 备用路由。SnapYT 至少两条不同公开视频必须得到可播放、含音频的 MP4，
且每条只产生一次 Provider attempt。任一失败先关闭 SnapYT rollout，再关闭其三个门禁。

YouTube 仍不加入 sitemap 或公开 SEO 页面；不使用 Provider 页面接力、服务器媒体代理、
转码或队列重放。
