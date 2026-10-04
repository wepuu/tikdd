# Work Item 147：yt-dlp YouTube 末级兜底验证与受控收口

## 状态

本地实施分支：`codex/wi147-ytdlp-youtube-beta-closeout`。本项基于 WI144、WI145 和 WI146，
当前只完成代码与测试准备，尚未推送、合并、部署或切换生产门禁。

## 目标

- NoAdsDL 继续作为 YouTube 主 Provider；SnapYT 保持关闭。
- 仅在闭门资格、Delivery 票据和浏览器保存均通过后，将 `ytdlp-isolated` 作为 YouTube
  最低优先级兜底。
- Dailymotion 当前 artifact 路由保持不变，不新增公开 API、数据库迁移或 SEO 页面。

## 实施阶段

1. 将 WI144–WI146 的连续提交一次性进入 CI，构建并核验 Service、Web、Admin 和
   yt-dlp Runner 的精确 SHA 镜像；备份 PostgreSQL、生产配置和 release manifest 后只部署一次。
2. 保持 YouTube 关闭，使用一个普通视频和一个 Shorts 样本执行 `ytdlp:qualify`。优先验证
   `direct`；只有 progressive MP4 不完整或不可跨出口交付时，才验证 `artifact`，必要时才评估
   `relay`。每种能力最多一轮两样本，不自动重试。
3. 资格通过后，写入唯一的 `ytdlp-isolated / youtube / nl` rollout rule，先保持
   `enabled=false/allocationBps=0`。在受控窗口临时让 yt-dlp 优先完成两条 Delivery 和浏览器
   下载验证，随后立即恢复 NoAdsDL 第一、yt-dlp 最后级的路由顺序。
4. 两条样本均通过后，保留 YouTube capability 和 rollout；任一样本失败则先关闭规则，
   再移除 YouTube approved capability 并重建 Worker。Dailymotion、NoAdsDL 和其他 Provider
   状态不变。

## 验收标准

- 普通视频和 Shorts 均能生成完整、非零、可播放的 MP4。
- 每个任务最多一条 yt-dlp attempt，Delivery 票据只能使用一次，重放返回 `410`。
- 缩略图有效时显示，缺失时安全回退平台图标，不影响下载。
- 路由优先级固定为 NoAdsDL `740`、SnapYT `720`（关闭）、yt-dlp `250`。
- 观察窗口内核心容器无重启，API/Delivery 无新增 5xx，artifact 不泄漏。

## 回滚

先将 `ytdlp-isolated / youtube / nl` 规则设为关闭和零分配，再清除 YouTube approved
platform/capability，并用同一发布脚本强制重建 Worker。必要时回滚到 WI143 的精确 SHA；不扩大
Delivery Host allowlist，不改 NoAdsDL 主路由。
