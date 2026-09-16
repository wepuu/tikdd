# Work Item 70 — Admin 常驻发布门禁契约

## 状态

实施中。该项修复生产发布脚本与当前 Admin 运营策略之间的契约不一致，不改变
Admin 鉴权、路由或容器生命周期。

## 背景

共享 VPS 当前按单人运营策略保持 `admin.tikdd.cc` 在线。主机 stage gate 在普通发布阶段
默认要求 Admin 返回 404，因此每次部署都会在基线阶段被安全地阻止，即使核心服务和资源
健康。这是发布配置契约问题，不是应用或 Provider 故障。

## 变更

- `scripts/production-release.sh` 新增 `TIKDD_ADMIN_ORIGIN_MODE`，默认 `stopped`，保持
  原有 404 门禁。
- 明确设置为 `always-on` 时，普通发布阶段要求 Admin 返回 200；显式 `admin-stop` 仍
  要求 404，`admin-on-demand` 仍要求 200。
- 对值域进行 fail-closed 校验，只接受 `stopped` 或 `always-on`。
- 更新发布文档与脚本契约测试。

## 发布边界

本项不启动或停止 Admin，不修改 Admin 镜像、账号、数据库、Provider、rollout、calibration
或公共 API。生产部署仍必须通过完整官方 stage gate、备份验证和逐服务健康检查；只是在
已批准的 Admin 常驻配置下，将正确的预期状态传递给主机门禁。
