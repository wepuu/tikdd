# Stage 3 — 内容资产与增长测量闭环

状态：实施中，基于 `main@ac6bbee` 创建阶段分支 `codex/stage3-growth-content-measurement`。

Stage 3 将下一阶段的内容扩充和增长测量收敛为一次发布。它复用现有结构化 CMS、SEO 护照、
不可变快照和 Stage 1 Google 集成，不新增 Provider、数据库、Google 报表 API、媒体传输方式
或常驻 Admin。

## 范围

- 补齐英文与简体中文 X Beta 平台页，并复核 Instagram Beta 内容。
- 保持 X/Instagram 页面 `noindex` 且不进入 sitemap；不宣称稳定支持或索引资格。
- 在 Web 增加固定的匿名事件目录：`resolve_submit`、`resolve_ready`、`resolve_failed`、
  `download_handoff`。
- 事件只允许平台、语言、页面类型和有限失败分类；不得发送 URL、任务/票据、Provider、
  CDN、媒体元数据、文件名、Cookie、IP 或自由文本错误。
- 在 Admin 增加只读“增长准备度”视图，汇总内容覆盖、发布 revision、GA/AdSense 配置状态
  和事件边界；不读取 Google 账户报表，也不伪造访问量或下载完成率。

## 设计边界

GA 事件仅在已发布快照包含合法 Measurement ID 时发送。跨域直连下载无法可靠证明文件已
保存，因此只记录 `download_handoff`，不创建 `download_complete`。AdSense 继续沿用固定的
代码归属脚本；未配置时不加载脚本。本阶段不新增同意管理、用户画像、分析数据库或服务端
遥测。

## 验收与发布

测试覆盖事件 allowlist、敏感字段拒绝、X/Instagram 双语页面、Beta/noindex/sitemap 边界、
旧快照兼容、Admin 响应式视图和现有发布模型。执行定向测试、`pnpm check`、Compose 校验和
PR CI；合并后只部署 GitHub 构建的精确 SHA 镜像。

生产发布遵循一次闭环：PostgreSQL 备份、部署、核心健康检查、一次 X 烟雾下载和短时观察。
不主动重复请求 SaveFromIns。内容公开发布另需获批的 on-demand Admin 会话：先用
`content-draft` 预览，确认后短暂使用 `full` 发布不可变快照，再停止 Admin。

## 不在本阶段

- Google Analytics Data API、Search Console API 或 AdSense 报表；
- 下载完成追踪、用户级标识、Cookie 画像或自建统计数据库；
- 新 Provider、SaveFromIns 替换、rollout/calibration 变更；
- X/Instagram 稳定晋级、sitemap/hreflang 收录或 Admin 常驻运行。

## 后续判断

Stage 3 完成后，以真实使用反馈和 Google 控制台数据评估内容迭代。免费 Provider 候选仍按
单个候选、公开内容、无 Cookie、无挑战绕过和 redirect-only 规则验证；只有独立稳定性和索引
资格证据充分后，才讨论平台稳定晋级。
