# Work Item 51 — 免费 Provider 组合验证与二级路由

状态：代码实现完成，候选仍未获得生产 Delivery 资格（2026-09-13）。

## 范围与基线

本批次从 `main@9c0a2591f315df11ed2b6a522e48de59243b7623` 开始。TikTok 已由 Work Item 50
提升为 stable 并进入中英文 sitemap；SnapTik Monster 是当前 TikTok 主路由，SaveFromIns 是
当前 Instagram Beta 主路由。Admin 按站点所有者要求保持运行，其他 Provider、calibration 和
新增流量不变。

本项只做一批离线候选筛选、适配器骨架和受边界约束的顺序回退。CI 与本地测试不向候选站点
提交真实用户 URL，也不创建 rollout rule。

## 候选矩阵

| 候选 | 平台 | 结果 | 原因 |
| --- | --- | --- | --- |
| TikVid.cc (`tikvid`) | TikTok | 已实现、deferred | 有静态公开表单和 MP4 解析 fixture；媒体主机和 302 行为尚未审核，暂为 resolution-only |
| SnapInsta.to (`snapinsta`) | Instagram | 已实现、deferred | 有静态公开表单和 Reel MP4 解析 fixture；媒体主机和 302 行为尚未审核，暂为 resolution-only |
| TokVid.io (`tokvid`) | TikTok | deferred | 只有候选记录，等待离线 fixture 与 Host 审查 |
| TikCD.com (`tikcd`) | TikTok | deferred | 只有候选记录，等待离线 fixture 与 Host 审查 |
| TikVid.io (`tikvid-io`) | TikTok | deferred | 只有候选记录，等待离线 fixture 与 Host 审查 |
| GramSnap (`gramsnap`) | Instagram | deferred | 只有候选记录，等待离线 fixture 与 Host 审查 |
| SaveVid.net (`savevid`) | Instagram | rejected | 公开页面宣称支持 private downloader，与 TikDD public-only 边界冲突 |

矩阵由 `@tikdd/providers` 的 `FREE_PROVIDER_PORTFOLIO` 和
`qualifyFreeProviderPortfolio()` 生成；它不是 Admin 或数据库配置，不会授权流量。

## 实现

- 新增 `TikVidProvider` 与 `SnapInstaProvider`，运行时校验 manifest、明确页面 Host、大小/超时/重定向边界、HTML 结果归一化和终态/可回退错误。
- 两个 manifest 默认 `enabled=false`、`deliveryModes=[]`、`verificationStatus=fixture_verified`。
  生产 Router 会过滤 resolution-only 能力，因此即使误设进程开关，也不会产生生产下载路由。
- 新增独立 terms/delivery-audit 门禁；Worker、API、Admin、preflight 均能识别候选，但生产环境
  的现有环境变量保持 false。
- 保持固定顺序、有限尝试与终态错误语义：TikTok 组合为
  `SnapTik Monster → TikVid`，Instagram 组合为 `SaveFromIns → SnapInsta`；主 Provider 成功
  时不调用二级 Provider。二级候选只在开发/fixture 测试中证明回退，不改变生产规则。
- 没有新增公共 OpenAPI 字段、数据库迁移、Delivery 主机白名单、公开上游 URL 或媒体代理。

## 验证与后续门槛

已加入成功、空结果、private、重定向越界、CDN 不泄漏、激活门禁和顺序回退测试。生产资格仍
需要每个候选至少四个负向 fixture、准确媒体 Host/redirect review、一次单独批准的真实验证，
然后才能把 capability 从 `resolution-only` 改成 `delivery_verified` 并创建唯一 rollout rule。

在候选获得 Delivery 资格前，生产保持 `snaptik-monster / tiktok / nl` 和
`savefromins / instagram / nl` 原有状态，且不增加候选请求频率。若未来真实验证出现 403、429
或 challenge，立即暂停对应候选，不绕过限制或扩大白名单。
