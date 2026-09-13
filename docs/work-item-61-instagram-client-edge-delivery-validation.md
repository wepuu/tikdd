# Work Item 61 — Instagram 客户端与边缘 302 技术验证

状态：已完成（技术证据批次；未接入生产）
基线：`main@867de6b57101223b5c96a1c1f7e2869c40cf2ea`

## 目标与边界

本批次按运营者要求排除 Provider 页面接力：TikDD 用户不应看到或操作第三方下载页面。
验证的替代路径只有两种：

1. 浏览器直接调用匿名 Provider API，再由浏览器访问返回的媒体地址；
2. Cloudflare Worker 调用 Provider API 并直接返回受限 `302`，不读取、缓存或转发媒体字节。

现有 TikDD Delivery 服务、公开 API、生产路由和数据库均未改变。测试不使用 Instagram Cookie、
登录、验证码、浏览器持久 Token 或规避限流的手段，也没有再次压测 SaveFromIns。

## 全量候选复核

本次把此前所有 Instagram 候选的协议证据与新的 CORS/边缘适用性合并复核。`浏览器` 表示能否
安全地由 TikDD Web 直接调用；`边缘` 表示能否由无 Cookie 的服务器/Worker 调用并取得可审查的
媒体 URL，而不是是否已经获准上线。

| 分组 | Provider | 浏览器直调 | 边缘解析/302 | 结论 |
| --- | --- | --- | --- | --- |
| 双路径候选 | `prexzy` | API 允许匿名跨域；真实浏览器本轮在 10 秒窗口超时 | NL 两个公开样本均返回可直达媒体；媒体后缀为 `instasave.website` | 唯一双路径首选；仍需稳定性和正式适配器评审 |
| 边缘候选 | `cliplatch` | API 无 CORS | 首样本返回 `cdninstagram.com` 媒体且 Range 为 `206 video/*`；确认样本超时 | 保留 experimental 备选，不合格上线 |
| 现有生产 | `savefromins` | CORS 可用但请求需要服务端密钥，禁止下发浏览器 | 现有 NL 解析与 TikDD 302 已验证，存在上游频率限制 | 保持现状，不重复测试 |
| 暂时故障 | `ahm7_alldl` | 无 CORS | 真实请求返回 HTTP 500 JSON、无媒体 | deferred |
| 会话不适配 | `fdown-vn` | 需要同站 XSRF/session，跨站匿名调用不成立 | 能解析到同站 HTML 资源，不能形成直达媒体 302 | no-media |
| 用户凭据边界 | `dlpanda` | 不允许；Instagram 需要用户 `sessionid` | 不允许 | blocked |
| 浏览器态/挑战 | `snapinsta`, `gramsnap`, `fastdl`, `igram-world`, `sssinstagram`, `inflact`, `savefrom-net`, `collabstr`, `igexport`, `indown`, `reelsvideo`, `save-free`, `anonsaver`, `outfame`, `iqsaved` | 无可安全复现的匿名 API | 登录、浏览器 Token、Turnstile/Cloudflare 或挑战边界 | blocked |
| 无媒体协议 | `fastvideosave`, `embedsocial-jp`, `snap-insta`, `dlreel`, `vidssave`, `downloadmedia-app`, `bolta-ai`, `luxa`, `sssinsta-za` | 页面级响应不能证明 API CORS | 未发现可复现的匿名媒体协议，或提交后只返回 HTML | no-media |

页面返回 `Access-Control-Allow-Origin` 不能单独证明浏览器直调可用：只有真实下载 API、允许的请求
方法/头、无服务端秘密和可用媒体结果同时成立才算通过。`inflact`、`igexport`、`vidssave` 等页面级
CORS 因此没有被误判为可用 API。

## 两条路径的实测结论

### 方案 2：浏览器直调 Provider API

Prexzy 的 `GET /download/igv2` 在协议检查中允许匿名跨域，且 NL 两次样本解析成功。真实 TikDD
页面来源的浏览器请求本轮在 10 秒内没有完成，说明 CORS 不是唯一风险：Provider 延迟、可用性和
客户端网络都会直接影响用户。更重要的是，这条路径会把 Provider 协议和返回载荷交给 Web，绕过
现有 Provider 规范化、尝试账本、熔断和服务端路由边界。

结论：技术上可试，但不作为正式实现。除非以后有明确理由接受 Web 与 Provider 的直接耦合，
否则不把方案 2 接入用户界面。

### 方案 3：Cloudflare Worker 解析后 302

已实现并通过本地安全原型测试，原型具备以下限制：

- 只接受经过规范化的 `instagram.com/reel/{shortcode}` HTTPS 地址；
- 要求 Bearer 授权，并用源 URL 哈希把临时范围锁定为单个测试样本；
- 只调用固定的 Prexzy `igv2` 端点，10 秒超时且不重试；
- 只接受明确的 `instasave.website` 标签边界，不接受相似域名、凭据、自定义端口或 HTTP；
- 成功只返回 `302 Location`，不请求或传输视频字节；错误只返回脱敏代码。

5 项本地测试全部通过，包括 Instagram Host 欺骗、媒体 Host 欺骗、未授权访问、成功 302 和
fail-closed 行为。Cloudflare 临时运行未完成：Wrangler 的 Windows `workerd` 依赖下载失败，
官方 Playground 也未在测试窗口内加载完成。因此本批次没有声称 Cloudflare 出口已验证，也没有
部署公开 Worker 或把临时原型提交进生产代码。

## 决策

- 不使用 Provider 页面接力。
- 不启用独立媒体 Delivery Proxy，视频字节仍应由用户浏览器直接向最终媒体 Host 获取。
- 不把浏览器直调 Provider API 接入生产；它会削弱现有边界，且本轮真实浏览器请求超时。
- Prexzy 是后续 Edge Resolver 的唯一首选；ClipLatch 仅作 experimental 备选。
- 下一项若继续，应实现“TikDD 签发短时一次性边缘票据 → Worker 验票并调用固定 Provider →
  静态 Host policy 校验 → 302”的正式设计。Worker 不接受任意上游 URL，也不返回 Provider JSON。
- 该设计改变解析与交付边界，正式实现前需要新 ADR；本项只是技术证据，不授权生产流量。

## 仓库与生产影响

- `provider:preflight` 增加 Luxa、Outfame、SSSInsta.co.za 和 IQSaved 的显式映射。
- 离线 Provider 组合记录更新 Prexzy/ClipLatch 证据状态，并加入上述四个候选。
- 没有新 Adapter、Manifest、Delivery Host policy、门禁、rollout rule、数据库迁移或公共接口。
- SaveFromIns 继续作为唯一 Instagram 生产 Provider；X、TikTok、Admin 与其他生产状态不变。
