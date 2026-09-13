# Work Item 60 — Instagram Provider 多维度技术验证

状态：已完成（证据批次，未创建 Adapter）
基线：`main@016ec7ebee086f735dadf911f7a32532677eabd9`

## 验证边界

本批次从 NL VPS 对四个候选执行网络、传输、页面协议、真实解析和媒体交付五个维度的验证。所有请求均使用 10 秒超时、无自动重试；页面和脚本检查不提交响应正文，真实解析只使用项目既有的公开 Reel 样本。测试没有请求 SaveFromIns，没有使用用户 Cookie、Instagram session、登录、持久化 Token、验证码或反自动化绕过。

媒体候选必须满足 HTTPS、无 URL 凭据、标准 443 端口、全公开 DNS、最多三次逐跳校验的重定向，并在不携带 Provider Cookie 的情况下响应 `Range: bytes=0-1023` 为 `206 video/*`。完整 URL、响应正文、Cookie/CSRF 值和查询参数均未记录。

## 多维度结果

| Provider | 网络与传输 | 协议发现 | 真实解析 | 媒体交付 | 判定 |
| --- | --- | --- | --- | --- | --- |
| `vidssave` | DNS 同时有公开 IPv4/IPv6；TLS 1.3 有效；HTTP 200 HTML；无重定向 | 页面未暴露可复现的同源表单或下载 API | 未提交，避免猜测协议 | 无候选 | `no-media` |
| `fdown-vn` | DNS 同时有公开 IPv4/IPv6；TLS 1.3 有效；HTTP 200 HTML；无重定向 | 同源 `POST /api/instagram/download`；需要页面匿名签发的临时 XSRF/session，不需要用户 Cookie 或登录 | 直接 API 返回 419；建立匿名会话后错误字段返回 422 并确认真实字段为 `url`；正确请求返回 HTTP 200 JSON，键为 `success`、`html` | 结果含两个同站资源；无 Cookie Range 均返回 HTTP 200 HTML，而非 `206 video/*` | `no-media`（解析可达，交付不合格） |
| `downloadmedia-app` | DNS 同时有公开 IPv4/IPv6；TLS 1.3 有效；HTTP 200 HTML；无重定向 | 同源 GET 表单字段 `dm-url`，未发现下载 API 或凭据依赖 | 单次 GET 提交返回 HTTP 200 HTML | 无有效 MP4 | `no-media` |
| `bolta-ai` | DNS 为公开 IPv4；TLS 1.3 有效；HTTP 200 HTML；无重定向 | 检查 20 个同源客户端脚本后仍未发现可复现的 Instagram 下载端点；发现的通用 API 不能证明该工具协议 | 未提交，避免猜测请求结构 | 无候选 | `no-media` |

四个站点都没有出现有效的挑战响应头、密码表单或可证明的登录要求。页面中普通的登录/验证码文字没有被当作技术阻塞证据。

## 判定

- 没有候选达到 `resolved`：没有任何媒体资源通过无 Cookie 的客户端直连 Range 验证。
- 没有第二 Reel 验证，因为第二样本只对首样本已通过媒体交付的候选执行。
- FDown 可以保留为“协议可达、交付不合格”的后续观察对象；除非其匿名结果能提供公开直连 MP4，否则不实现 Adapter，也不把同站 HTML 下载页误当成媒体 URL。
- VidsSave、DownloadMedia.app 和 Bolta AI 在当前协议下没有足够证据进入适配器阶段。

## 仓库和生产影响

- `provider:preflight` 增加四个显式候选映射。
- `FREE_PROVIDER_PORTFOLIO` 增加四条 `technicalState=no-media` 的离线记录。
- 更新路线图和资格测试，不新增 Provider manifest、Delivery Host policy、环境门禁、rollout rule、数据库迁移或公共 API。
- 临时探测脚本已从本机和 NL VPS 删除。生产不部署，SaveFromIns 继续作为唯一 Instagram Provider。
