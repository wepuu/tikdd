# Stage 2 — Admin 内容与增长发布中心

状态：实施中，基于 `main@96a4ad6` 创建阶段分支 `codex/stage2-admin-publishing-center`。

Stage 2 将现有的结构化 CMS、SEO 技术护照、不可变快照和 Google 集成整合为一个 Admin
发布闭环。它不引入新的 Provider、媒体传输方式、公开接口或数据库迁移，也不改变 X/Instagram
的 rollout 和门禁状态。Admin 仍按需启动，生产默认保持 `readonly`。

## 本阶段交付

- 发布中心：汇总草稿数、内容覆盖缺口、SEO 阻塞、快照传播和 Google 集成状态。
- 发布前检查：把内容、SEO 和传播失败统一显示为可操作的阻塞项，并链接到现有处理台。
- 快照状态：显示当前 revision、待确认快照和待发布差异；不暴露上游 URL、任务数据或秘密。
- 响应式与键盘可用的 Admin 展示，沿用现有控制台设计令牌。
- Stage 1 文档状态收口，明确 GA/AdSense 只有在管理员发布快照后才会在 Web 生效。

## 设计边界

发布中心是只读聚合视图，不绕过现有 `content-draft`/`full` 写入范围，也不创建新的发布命令。
所有内容、SEO、集成字段继续通过既有 Zod 契约、revision 冲突检查、幂等键和 Web
acknowledgement 流程处理。任一数据源不可用时显示“不可用”，不推断为健康或可发布。

## 验收与发布

本阶段使用一个分支、一个 PR 和一次生产发布。最终执行 Admin 定向测试、`pnpm check`、Compose
校验和 PR CI；合并后只使用 GitHub 构建的精确 SHA 镜像。生产发布前备份 PostgreSQL，部署后
按需启动 Admin 完成一次只读/内容草稿检查，确认六个核心容器健康后停止 Admin。不会因此启动
Provider、calibration 或其他新增流量。

## 后续判断

本阶段完成后再进入内容扩充与增长数据阶段。新的免费 Provider 继续单独验证，不与 Admin 发布
中心混合；X 和 Instagram 仍保持 Beta/noindex，除非后续拥有独立的稳定性和索引资格证据。
