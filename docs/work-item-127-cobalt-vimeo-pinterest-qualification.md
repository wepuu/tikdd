# Work Item 127：Cobalt Vimeo / Pinterest 二级路由资格验证

## 状态

初始证据为 `deferred`。WI126 已完成代码和资格判定，但本项尚未在 NL 私有 Cobalt
实例上执行真实样本；因此 Vimeo、Pinterest 均不得进入 Worker、rollout 或生产门禁。

## 批次范围

本批只验证两个已经存在 TikDD 平台目录的候选二级能力：

- Vimeo：现有 VidDown 为主 Provider，Cobalt 只作顺序备用；
- Pinterest：现有 Pinterest Video Downloader 为主 Provider，Cobalt 只作顺序备用。

YouTube、xHamster 和 WI125 已失败的 OK.ru 不在本项范围。Cobalt 运行时额外公布的服务
只记录为后续候选，不在本项新增平台、Provider adapter、SEO 页面或 sitemap 条目。

## 封闭门禁验证

测试前备份 Cobalt API key secret，并将其 `allowedServices` 临时收窄为 `vimeo`、
`pinterest`。保持 Worker 未启用、三个 Cobalt 门禁为 false、rollout 不存在或保持 0，
只启动私有 Cobalt profile。

使用两条 Vimeo 和两条 Pinterest 的公开样本，每条只发送一次 POST `/`，15 秒超时，
间隔至少 10 秒。只接受 `redirect` 或包含视频的 `picker`；拒绝 `tunnel`、
`local-processing`、HLS-only、Provider 页面和音视频分离结果。

每个视频候选必须通过 HTTPS、公共 DNS、现有或新增版本化 Host policy、最多三次重定向、
1 KiB Range，以及 NL、本机直连和本机 v2rayN 三出口验证。浏览器交付必须支持附件下载
或已审计的 CORS 保存路径。所有响应只保留脱敏状态、数量、MIME、Range、重定向和失败码。

## 上线条件

只有同一平台的两个样本都达到 `qualified-secondary`，才允许：

1. 更新该平台的资格证据和 Host policy；
2. 保持主 Provider 优先级高于 Cobalt；
3. 将该平台加入 `COBALT_APPROVED_PLATFORMS` 和 `COBALT_DELIVERY_VERIFIED_PLATFORMS`；
4. 创建唯一的 `cobalt-selfhosted / <platform> / nl` 规则；
5. 通过 `worker-config-apply` 重建 Worker；
6. 进行一次 Provider-pinned canary 和客户端下载验证。

一个平台失败不影响另一个平台。若两个平台均失败，关闭本项，Cobalt 保持停止，现有
Vimeo/Pinterest 主 Provider 和生产流量不变。
