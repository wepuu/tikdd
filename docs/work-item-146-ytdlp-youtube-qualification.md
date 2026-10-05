# Work Item 146：yt-dlp YouTube 闭门资格验证

## 状态

实现分支：`codex/wi146-ytdlp-youtube-qualification`。本地实现基于 WI144/WI145，尚未推送、
合并或部署。

## 实现内容

- 新增 `@tikdd/preflight` 的 `ytdlp:qualify` 命令。
- 输入只允许一到两条 YouTube 样本和一个显式交付能力：`direct`、`relay` 或 `artifact`。
- 样本按顺序执行，间隔至少 15 秒（与 Runner 的 YouTube admission guard 对齐）；输出不含源 URL、媒体 URL、artifact ID、签名参数、Cookie、
  请求头或响应正文。
- 若 YouTube 已出现在 Worker approved platforms 或 verified capabilities 中，资格验证立即拒绝。
- 新增 `ytdlp-qualification` 一次性 Compose 服务，使用只读运行目录、Runner HMAC secret 和
  provider-egress 网络。
- 官方发布脚本新增 `ytdlp-youtube-qualification` 操作，严格校验输入文件为 `/run/tikdd/`
  下 UID-1000、mode 600，并在执行结束后删除。

## 生产边界

本项不启用 YouTube，不创建 rollout rule，不关闭 NoAdsDL，不启动 SnapYT，也不改变
Dailymotion 当前状态。资格结果只证明 Runner 解析能力；两条样本的 Delivery ticket、浏览器
保存和非零可播放文件仍需后续单独授权窗口完成。

## 验证

覆盖样本数量、平台 Host 校验、活动配置隔离、顺序间隔、脱敏输出、Compose 服务边界、发布
脚本输入权限和一次性执行路径。
