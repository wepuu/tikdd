# Work Item 52 — 免费 Provider 交付资格验证

状态：完成，两个候选均保留关闭并记录为 `canary_failed`（2026-09-13）。

## 范围与基线

本项从 `main@97d6e3680886340c965347b84030326f32dda2c9` 开始，只验证 Work Item 51
已经实现的 TikVid.cc 与 SnapInsta.to 候选。验证从 NL VPS 发起，使用受限请求次数；不创建
rollout rule，不增加 Delivery Host policy，不启动 calibration，也不改变现有生产 Provider。

## 脱敏技术证据

| Provider | NL 结果 | 结论 |
| --- | --- | --- |
| TikVid.cc | 首页 `200`；真实表单省略 `method`，浏览器语义为 `GET`；提交后同站点 `302`，最终页面 `200`，但有效 MP4 数量为 `0` | `canary_failed`；没有可审核的媒体 Host，不能获得 redirect 交付资格 |
| SnapInsta.to | 首页请求直接返回 `403 text/html`，响应明确标记 `cf-mitigated: challenge` | `canary_failed`；未继续提交 Instagram URL，也不尝试绕过挑战 |

记录只包含 HTTP 状态、内容类型、重定向类别、响应大小和有效 MP4 数量。没有保存或提交到
仓库的原始用户 URL、Cookie、CSRF 值、页面正文、标题或 CDN 完整地址。

## 实现

- 通用免费站点适配器遵循 HTML 标准：表单未声明 `method` 时按 `GET` 提交；显式 `POST`
  仍保持原行为。
- 结果解析不再把只有“Download”字样的普通导航链接当成视频；候选必须具有 MP4 路径，
  或标签明确包含 `MP4` / `video`。
- TikVid 和 SnapInsta manifest 保持 `enabled=false`、`deliveryModes=[]`，能力证据改为
  `canary_failed`。
- 离线候选矩阵增加 `canary-failed` 证据状态和 `canary_failed` 延迟原因。负向 Canary 不等于
  永久拒绝，但在新的成功证据出现前不能进入生产路由。
- Fixture 覆盖真实 TikVid GET 表单、同 Host 有界 302、普通下载导航假阳性、挑战和已有终态错误。

## 保持不变

- TikTok 继续只使用 `snaptik-monster / tiktok / nl`；Instagram 继续只使用现有
  `savefromins / instagram / nl` 规则。
- 不增加媒体 Host 白名单、公开上游 URL、媒体代理、数据库迁移或公共 API 字段。
- Admin 保持现有运行策略；本项不要求重启或部署生产服务。

## 后续

TikVid 和 SnapInsta 暂时退出二级生产候选。下一轮免费 Provider 验证应从剩余队列中选择：
TikTok 的 TokVid/TikCD/TikVid.io，Instagram 的 GramSnap。每次仍先做页面与挑战检查，通过后
才提交一个公开样本；只有返回稳定 MP4 且完成精确媒体 Host/redirect 审查的 Provider 才能
新增 `delivery_verified` capability 和唯一 rollout rule。
