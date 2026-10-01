# Work Item 128：Cobalt 核心平台二级路由批量验证

## 状态

已完成闭门验证，未达到任何平台的 `qualified-secondary`。WI127 的 Vimeo/Pinterest 结果不在本批重试；
本批只验证已有 X、Instagram、TikTok、Facebook 主 Provider 的 Cobalt 顺序备用能力。

### 2026-10-01 脱敏结果

- X：两条解析均成功（`redirect`/`picker`），NL 与本机 v2rayN 的 1 KiB Range 均为
  `206 video/mp4`；本机直连两条均超时。因此为 `delivery-blocked`，失败码为
  `cross_exit_unverified`、`browser_save_unverified`。
- Instagram：两条解析一次成功、一次返回上游空结果错误包；为 `no-media`，失败码为
  `provider_error_envelope`。未继续做跨出口和浏览器保存。
- TikTok：两条均返回 `tunnel` 结果，属于 Provider 代理流；为 `proxy-only`，失败码为
  `non_portable_result`，不引入 TikDD 媒体中转。
- Facebook：两条解析均成功，NL 与本机 v2rayN 的 1 KiB Range 均为 `206 video/mp4`；
  本机直连两条均超时。因此为 `delivery-blocked`，失败码为 `cross_exit_unverified`、
  `browser_save_unverified`。

本批使用正确的生产 UA `TikDD/cobalt-secondary`，运行时、服务清单和 API key 均通过；上述
结果不代表 Cobalt 或现有主 Provider 故障，而是本批交付门槛未满足。Cobalt 未获得任何生产路由资格。

## 仓库阶段

- 先合并 WI126/WI127 的单一证据 PR；合并前不部署生产。
- 本项新增按平台隔离的 fail-closed 证据模型和测试。
- 不新增公共 API、数据库、Admin、SEO 页面、sitemap 或媒体中转。
- Cobalt 只能位于现有主 Provider 之后，优先级固定为 `450`。

## 闭门验证

1. 备份生产 Cobalt secret、配置和 release manifest。
2. 临时将 key 的 `allowedServices` 限定为 `twitter`、`instagram`、`tiktok`、`facebook`。
3. 只启动私有 Cobalt profile，使用生产 UA `TikDD/cobalt-secondary`。
4. Worker、三个 Cobalt 门禁和 rollout 保持关闭。
5. 每个平台使用两个公开样本，每条请求一次，15 秒超时，间隔至少 10 秒；最多八次解析请求。
6. 仅接受 `redirect` 或包含视频的 `picker`；拒绝 tunnel、local-processing、HLS-only、音视频分离和 Provider 页面。
7. 每个平台的成功候选必须通过现有 Host policy、HTTPS、公共 DNS、三次重定向限制、1 KiB Range，
   以及 NL、本机直连、本机 v2rayN 三出口检查。
8. 只有跨出口通过后才执行浏览器附件或审计过的 CORS 保存验证。

所有证据只保存平台、响应模式、数量、状态、MIME、Range、重定向、耗时和脱敏失败码；不保存
源 URL、完整媒体 URL、查询参数、Cookie、Token 或响应正文。

## 路由与发布

只有单个平台两条样本全部通过，才允许将该平台加入
`COBALT_DELIVERY_VERIFIED_PLATFORMS`，创建唯一的 `cobalt-selfhosted / <platform> / nl`
规则，并在生产部署后启用对应二级路由。主 Provider 始终保持更高优先级。

若某个平台失败，只关闭该平台；若四个平台全部失败，保留证据并关闭本项，不启动 Cobalt，
不改变现有生产流量。出现新的 CDN Host 时不得在本项扩大白名单，需另行安全评审。

## 完成标准

- WI126/WI127 单一 PR 合并，生产无变更；
- 四个平台各有明确资格结论（X/Facebook `delivery-blocked`、Instagram `no-media`、TikTok `proxy-only`）；
- 没有平台进入后续路由 PR 或生产发布；
- Cobalt、Worker、rollout 和 secret 在验证结束后恢复到原状态；
- `pnpm check`、Compose 校验和脱敏扫描通过。
