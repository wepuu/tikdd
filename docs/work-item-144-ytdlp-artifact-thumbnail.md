# Work Item 144：yt-dlp Dailymotion artifact 缩略图修复

## 状态

实现分支：`codex/wi144-ytdlp-artifact-thumbnail`。基线为 `main@40b0110d1271ea2ed96f9e4865bbaba7a5380791`。

## 根因

正常抽取路径已经从 yt-dlp 结果读取并审查 Dailymotion 缩略图，但临时 artifact 路径的
`after_move` 输出没有包含 `thumbnail`，随后响应又固定写入 `thumbnailUrl: null`。因此视频
artifact 能够成功生成，Web 却只能显示平台图标。

## 修复

- Runner 的 `after_move` 元数据增加可选 `thumbnail` 字段。
- artifact 与普通抽取共用 `reviewedYtDlpThumbnailUrl`。
- 仅接受 HTTPS、无凭据、无自定义端口、精确主机 `s1.dmcdn.net` 或 `s2.dmcdn.net` 的图片
  元数据；移除 fragment。无效值降级为 `null`，不影响 MP4。
- Provider、Delivery、公共 API、文件传输、门禁和 rollout 均保持不变。

## 验收

覆盖有效缩略图、fragment 清理、HTTP/凭据/自定义端口/伪造主机/未知主机拒绝，以及无效
缩略图不阻塞 artifact。Provider 回归确认缩略图能从内部 artifact 响应进入公共规范化结果，
且仍不泄漏 artifact ID、文件路径或媒体 URL。

本项只做代码、测试和文档变更；合并后的镜像核验、生产部署及一次人工 Dailymotion 缩略图
复测需单独执行，不主动重复请求生产 Provider。
