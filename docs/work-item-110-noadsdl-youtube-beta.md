# Work Item 110 — NoAdsDL YouTube Beta 接入与交付审计

## Scope

本项在 `main@5c07ab3` 之后加入 NoAdsDL 的 YouTube-only、默认关闭适配器。它不修改公共
API、数据库、Admin 生命周期或现有 X/Instagram/TikTok/Facebook/Vimeo/Pinterest 路由，也不
执行生产部署。

## 技术结论

NoAdsDL 的匿名协议由 `video-info → download job → status poll → generated file` 组成。两条
公开 YouTube 样本都返回可交付的 MP4，但媒体来自 NoAdsDL 自有 Provider stream，最终资格
仍需 Delivery host policy 和浏览器审计。SnapYT 保持独立的备用 Lab 路由；本项不把两者并发
调用或合并为一个适配器。

## 已实现

- 新增 `NoAdsDLProvider`，只接受规范化 YouTube URL，选择免费 combined MP4，最多十次轮询。
- 新增 `noadsdl-youtube-media-v1`，只允许 `noadsdl.com/api/free-download/file` 路径。
- 新增 Worker/Admin/preflight 三门禁与限流配置；默认关闭且不创建 rollout rule。
- 禁止队列自动重放 NoAdsDL；诊断字段脱敏，不写入源 URL、Cookie、Token、正文或媒体地址。
- 新增 parser、Delivery、激活、路由、重试和发布脚本测试及 ADR/Provider 文档。

## 发布门槛

CI 通过后只构建精确 SHA 镜像，不自动启用 Provider。未来若单独批准生产验证，应先备份并
部署，确认 Worker 使用新配置，再启用三个门禁、创建唯一 `noadsdl / youtube / nl` 规则，
用两个不同公开样本各完成一次浏览器下载和短时观察。任一样本失败时先关闭 rollout，再
关闭门禁；NoAdsDL 不得引入服务器媒体中转或页面接力。
