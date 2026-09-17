# Work Item 73 — SocialDownloader Facebook 生产资格审计与受控上线

状态：已完成；生产门禁和 rollout 已启用，FDown 保持主 Provider。

基线为 `main@25bd4b625c6d45c9b6be94d817fc57d79d9d8af8`。Work Item 71 的两个 Facebook
样本已证明 SocialDownloader 能返回 MP4，但媒体是 Provider 自有 `/api/video` 流，不是
源平台 CDN。Work Item 72 已将它实现为 FDown Isuru 之后的默认关闭二级路由。本项完成发布
环境绑定、真实浏览器交付审计和可回滚的 Facebook 受控上线；不扩展到 X、TikTok、Instagram
或 YouTube。

生产记录：SocialDownloader 三个门禁已通过 `worker-config-apply` 生效，唯一的
`socialdownloader-space/facebook/nl` 规则已启用并保持为 FDown 之后的二级路线。两条公开
Facebook 样本各产生一次 SocialDownloader attempt，并完成一次性票据、受审 302 和非零媒体
流交接；核心容器、API/Delivery 5xx、重启和熔断在十分钟观察窗口内保持正常。当前交付策略
仍为 `navigate`，浏览器可能打开 Provider 媒体流/播放器；未宣称自动保存，详见 Work Item 74。

## 已完成的代码工作

- `production-release.sh worker-config-apply` 现在校验每个 Provider 的三元门禁，包含
  FDown Isuru 和 SocialDownloader；只重建 Worker，并核对配置 revision。
- 发布文档明确禁止使用未绑定 `TIKDD_RELEASE_ENV` 的裸 Compose 命令更新 Provider 门禁。
- SocialDownloader 的 Provider、Host Policy、顺序 fallback 和一次性 302 边界保持不变。

## 生产执行顺序

1. 核验 `774491d` 的 Web、Service、Admin GHCR 镜像 digest 和 GitHub Release Images 来源。
2. 在 NL VPS 备份 PostgreSQL、生产环境文件和 release manifest；保持 SocialDownloader 三个
   门禁为 `false`，不创建 rollout rule，部署后验证现有 X、Instagram、TikTok 和 FDown。
3. 对两条既有公开 Facebook 样本各执行一次低频交付审计：验证 `/api/video` 的 HTTPS、公共
   DNS、重定向、`video/mp4`、Range、Content-Disposition、CORS、有效期和浏览器保存结果。
   不显示 Provider 页面，不让 NL VPS 读取或转发媒体字节。
4. 若 `navigate` 能保存文件，继续使用当前手递策略；若只能打开播放器但 CORS 满足安全
   客户端保存条件，则另行提交 `cors-download` 变更；两者均不满足时保持 Provider 关闭。
5. 审计通过后，设置三个 SocialDownloader 门禁为 `true`，使用 `worker-config-apply` 验证
   Worker revision 和门禁，再通过 CAS 创建唯一的 `socialdownloader-space/facebook/nl`
   rollout rule，分配 `10000`。
6. 临时让 SocialDownloader 成为 Facebook 首选完成两条样本验证；完成后恢复正式顺序
   `FDown Isuru → SocialDownloader`，不保留临时首选流量份额。
7. 观察 10 分钟：核心容器重启为 0、API/Delivery 无新增 5xx、attempt 数量正确、熔断器
   未开启，且媒体流量不经过 NL VPS。

## 回滚

任何样本失败、安全校验异常、播放器/保存行为不符合预期或核心服务异常时，先恢复
FDown-only 路由，再 CAS 关闭 SocialDownloader rollout，最后关闭三个门禁并执行同一
`worker-config-apply`。只有发布版本本身异常时才回滚 `774491d`；不扩大 Host Policy、
不增加重试、不引入服务器媒体代理。

## 完成标准

- 两条样本各产生恰好一条 SocialDownloader attempt，并完成一次性 ticket、受审 302 和非零
  可播放文件验证。
- Facebook 继续以 FDown 为主、SocialDownloader 为二级 experimental Provider；不加入 sitemap，
  不改变其他平台和 Provider。
- 生产证据只记录脱敏状态、HTTP 状态、内容类型、耗时、资源计数、Host 后缀和回滚动作，
  不记录源 URL、完整媒体 URL、签名查询参数、Cookie、Token 或响应正文。
