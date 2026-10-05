# Work Item 150：yt-dlp YouTube 闭门验证与末级路由启用

## 状态

实施中。本文记录生产资格验证和受控收口边界；在闭门验证完成前，不启用
`ytdlp-isolated / youtube / nl`，NoAdsDL 继续作为 YouTube 主 Provider。

## 当前基线

- 生产代码：`main@45f4fd1666e53e4f8fae217156987a89c9aca1c4`
- NoAdsDL：优先级 `740`，保持启用并承担 YouTube 正常流量。
- yt-dlp：Runner 和 PO Token 运行时已部署，但 `YTDLP_APPROVED_PLATFORMS` 目前只包含
  `dailymotion`。
- SnapYT：保持关闭。
- 用户请求命中 NoAdsDL 属于当前配置的预期结果，不代表 yt-dlp YouTube 路径已经验证。

## 阶段一：闭门资格验证

1. 备份 PostgreSQL、`production.env` 和当前 release manifest，并记录 Service、Web、Admin、
   Runner 以及 PO Token sidecar 的精确镜像 digest。
2. 准备一条普通 YouTube 视频和一条 Shorts 样本。输入文件只放在 VPS 的
   `/run/tikdd/ytdlp-qualification-input.json`，权限为 `0600`、服务 UID 为 `1000`，执行后删除。
3. 保持 YouTube 不在 Worker 的批准平台和交付能力列表中，运行：
   `scripts/production-release.sh ytdlp-youtube-qualification`。
4. 以 `capability=artifact` 顺序执行两条样本，间隔至少 15 秒且不自动重试；该间隔与 Runner
   的 YouTube admission guard 一致，避免资格程序触发自身限流。
5. 只接受脱敏结果：两条均为 `resolved`、存在非零可播放 MP4、PO Token sidecar 实际可用，
   且结果不含源 URL、媒体 URL、Cookie、Token、请求头或响应正文。

资格失败（429、挑战、Visitor Data/PO Token 缺失、无媒体、超时或 artifact 无效）时，
停止本项，不修改 NoAdsDL、SnapYT 或生产流量。

## 阶段二：受控生产验证

只有阶段一全部通过后，才执行以下独立授权窗口：

1. 将 `youtube` 加入 `YTDLP_APPROVED_PLATFORMS`，将 `youtube:artifact` 加入
   `YTDLP_DELIVERY_VERIFIED_CAPABILITIES`，使用 `worker-config-apply` 强制重建 Worker，
   并从容器内核对 configuration revision 和批准能力。
2. 读取现有 rollout 规则，CAS 更新唯一的 `ytdlp-isolated / youtube / nl` 规则为
   `allocationBps=10000`；禁止创建重复规则。
3. 为避免 NoAdsDL 掩盖验证结果，在不超过 10 分钟的窗口内将 NoAdsDL YouTube allocation
   临时设为 `0`；不清除其三个门禁，SnapYT 继续关闭。
4. 用普通视频和 Shorts 各执行一次浏览器下载。每条任务必须只有一个
   `ytdlp-isolated` attempt、一个一次性 Delivery ticket，并得到非零、可播放的 artifact。
5. 观察 Runner、PO Token sidecar、Worker、API 和 Delivery 健康状态。

## 正式路由与恢复

两条生产验证均成功后立即恢复：

- NoAdsDL allocation `10000`、优先级 `740`，继续作为主路由；
- yt-dlp allocation 保持 `10000`、优先级 `250`，仅在 NoAdsDL 返回允许 fallback 的类型化错误时使用；
- SnapYT 保持关闭。

两条验证中任一失败时，先关闭 yt-dlp rollout，再恢复 NoAdsDL allocation，移除 YouTube 批准能力，
通过 `worker-config-apply` 重建 Worker，并停止仅供 YouTube 使用的 PO Token sidecar。

## 完成标准

- 闭门普通视频和 Shorts 均通过；
- 受控浏览器验证明确命中 yt-dlp，而不是 NoAdsDL；
- 下载 artifact 非零且可播放；
- NoAdsDL 恢复为主 Provider，yt-dlp 仅作为末级备用；
- 无公共 API、数据库、SEO 或 Provider 页面接力变更；
- 记录脱敏 attempt、Delivery、digest、配置 revision 和回退结果。
