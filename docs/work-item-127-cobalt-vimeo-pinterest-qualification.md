# Work Item 127：Cobalt Vimeo / Pinterest 二级路由资格验证

## 状态

闭门验证已完成，两个平台均未达到 `qualified-secondary`，不进入 Worker、rollout 或生产门禁。
运行中的私有 Cobalt 为 11.7.1，服务发现和临时收窄后的 API key 均确认包含 Vimeo/Pinterest；验证结束后
secret 已恢复、Cobalt 已停止，Worker 与现有生产流量未改变。

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

## 脱敏执行证据

- Vimeo：两次解析均返回 `400 error.api.fetch.fail`，没有 `redirect` 或 `picker` 媒体候选，记录为
  `no-media`。这不是 Delivery 或跨出口失败，当前不创建 Vimeo Cobalt 二级路由。
- Pinterest：两次解析中一次返回一个 `redirect` 的 HTTPS MP4 候选，候选通过 NL 出口的 `206 video/mp4`
  1 KiB Range 检查；确认样本返回 `400 error.api.fetch.critical`。成功候选的媒体主机符合现有
  `pinimg.com` policy，但本机直连出口无法连接，v2rayN 出口可返回 `206 video/mp4`，因此跨出口门禁失败，
  浏览器保存门禁未执行，记录为 `delivery-blocked`。
- 首次探测使用了未列入生产 key 白名单的临时 User-Agent，Cobalt 返回
  `error.api.auth.key.ua_not_allowed`；该次结果不计入平台证据。随后使用生产适配器的
  `TikDD/cobalt-secondary` 重做了四条样本，未改变任何生产流量。
- 测试结束后删除临时媒体地址，恢复 secret 原始 SHA，停止 Cobalt；Worker 保持 healthy，三个 Cobalt
  门禁保持 `false`，rollout 未创建或修改。

## 上线条件

只有同一平台的两个样本都达到 `qualified-secondary`，才允许：

1. 更新该平台的资格证据和 Host policy；
2. 保持主 Provider 优先级高于 Cobalt；
3. 将该平台加入 `COBALT_APPROVED_PLATFORMS` 和 `COBALT_DELIVERY_VERIFIED_PLATFORMS`；
4. 创建唯一的 `cobalt-selfhosted / <platform> / nl` 规则；
5. 通过 `worker-config-apply` 重建 Worker；
6. 进行一次 Provider-pinned canary 和客户端下载验证。

一个平台失败不影响另一个平台。本批 Vimeo 为 `no-media`、Pinterest 为 `delivery-blocked`；WI127
正常关闭，Cobalt 保持停止，现有 Vimeo/Pinterest 主 Provider 和生产流量不变。若未来重新验证，
必须先有新的上游证据或本机直连出口恢复，再创建独立 Work Item。
