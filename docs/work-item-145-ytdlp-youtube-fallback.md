# Work Item 145：yt-dlp YouTube 最后级兜底准备

## 状态

实现分支：`codex/wi145-ytdlp-youtube-fallback`。本分支基于 WI144 本地提交，尚未推送或部署。

## 本次实现

- 新增版本化 `ytdlp-youtube-artifact-v1` Delivery policy，复用现有受限 artifact 根目录、
  300 MiB 上限、SHA-256 校验、15 分钟生命周期和一次性下载。
- artifact 文件名按平台生成：`TikDD-Dailymotion-*` 或 `TikDD-YouTube-*`，避免平台标签硬编码。
- 增加 YouTube artifact policy 与 Provider 路由契约测试。
- 不新增 YouTube 门禁、rollout rule、生产配置或公共页面；NoAdsDL 继续是主 Provider，
  SnapYT 继续关闭。

## 后续资格验证

使用既有普通视频和 Shorts 样本各一次，先检查 yt-dlp 是否有包含音视频的可跨出口 MP4；
只有 progressive MP4 不可用而 HLS/DASH 或音视频分离时，才评估 Runner artifact。禁止账号、
Cookie、验证码绕过和自动重试。两条样本均通过 Delivery、浏览器下载和非零可播放文件验证后，
才可单独申请 YouTube capability 与 rollout；任一失败保持关闭。

## 验证

本地已通过 Delivery-core 和 yt-dlp Provider 定向测试（35 tests）以及相关包类型检查。
完整资格验证、生产镜像核验、部署和人工浏览器验证不在本次本地实现中。
