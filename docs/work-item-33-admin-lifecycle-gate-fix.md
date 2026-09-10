# Work Item 33 — Admin 按需运行闭环与发布门禁修复

Status: merged by PR #71 and deployed from `main@8218b56881f847e6b3abd9acbd846bbc5dc55e6b`.

## Trigger

Work Item 32 的 Admin 只读预览已在 NL VPS 完成人工验证。`solo` 登录成功，Beta 健康面板可正常
查看；预览结束后 Admin 已停止，`https://admin.tikdd.cc/login` 恢复 404，六个公共核心容器保持
healthy。

预览暴露了两个发布流程问题：

1. `scripts/production-release.sh` 在 Linux 主机上是 `0644`，直接执行会收到 `Permission denied`。
2. 主机阶段门禁把 Admin origin 固定要求为 404，并把已停止 Admin 容器的历史 health 状态视为
   unhealthy。因此正常的 `admin-start` 会被误判失败，`admin-stop` 也可能因瞬时负载或停止容器
   状态被误判失败。

## Scope

- 将生产发布脚本作为可执行文件跟踪。
- 让发布脚本向阶段门禁传递 `TIKDD_STAGE_EXPECTED_ADMIN_STATUS`：普通阶段和
  `admin-stopped` 为 404，只有 `admin-on-demand` 为 200。
- Admin 启动或启动后的门禁失败时，自动停止 Admin/Admin API，避免失败命令留下运行中的私有面板。
- 保持 Admin API 4100 仅容器内部可达，Admin UI 仍只通过 loopback 3301 接入 Nginx/Tunnel。
- 更新主机门禁运维契约：仅检查运行中容器的 health；停止的 on-demand Admin 不得被视为 unhealthy。
- 增加静态契约检查和文档记录；不新增数据库迁移、Provider、rollout、calibration 或 Cloudflare Access。

### Host gate contract

The host-owned `/usr/local/sbin/tikdd-stage-gate` remains outside the repository. Before the next
production deployment, its Admin origin assertion must use the release-provided value rather than a
literal 404:

```sh
expected_admin_status="${TIKDD_STAGE_EXPECTED_ADMIN_STATUS:-404}"
check_tikdd_origin admin.tikdd.cc / "$expected_admin_status"
```

Its container loop must reject `unhealthy` only when `running=true`; stopped containers are not a
health failure. The installed gate must be backed up, syntax-checked and hashed after this change.

## Verification

- `pnpm verify:work-item-16`：生产 Compose、网络、端口、发布脚本和 Admin 生命周期契约。
- Admin API/Admin UI 现有测试及 `pnpm check`。
- Linux shellcheck 等价语法检查或 `sh -n scripts/production-release.sh`。
- 经独立发布授权后，使用 GitHub 精确 SHA 镜像进行一次 Admin start/login/read-only/stop 验证；
  同时回归一次 X 和一次 Instagram 下载，并观察 10–15 分钟。

## Production closeout (2026-09-10)

The approved release used the GitHub-built images for `main@8218b56881f847e6b3abd9acbd846bbc5dc55e6b`
and an encrypted PostgreSQL backup before the symlink switch. The installed host gate was backed up,
syntax-checked, and hashed after the expected-Admin-status and stopped-container checks were corrected.
Six public core containers stayed healthy with zero restarts during the 15-minute observation; public
Web/API probes returned 200 and the Delivery invalid-ticket probe returned 410. The owner-only Admin
preview completed login and read-only Beta rendering, then both Admin containers were stopped and the
Admin origin returned 404 again. X/Instagram rollout rules and gates were unchanged.

## Release boundary

- 本 Work Item 不会让 Admin 常驻；验证结束后必须回到 stopped 状态。
- 不改变 X/Instagram rollout revision、Provider gates、Provider 优先级或用户下载路径。
- 不启动 calibration、Canary、evidence、cleanup 或其他 Provider。
- 推送、合并和生产部署需分别获得授权；本地未跟踪的 `apps/web/.next-web-qa/` 保留且不纳入提交。

## Acceptance

- `production-release.sh admin-start` 在 Admin 返回 200 时门禁通过。
- `production-release.sh admin-stop` 在 Admin 返回 404 时门禁通过，停止容器不会触发 unhealthy 误报。
- 任一启动失败路径都会清理 Admin pair，公共服务不受影响。
- Admin 登录、只读 Beta 面板和 no-store/noindex/loopback 边界保持有效。
- WI32 的生产预览证据与本次门禁修复记录在路线图和部署手册中。
