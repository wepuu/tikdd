# Work Item 34 — Admin Provider 请求节奏与冷却提示

Status: implementation in progress on `codex/wi34-admin-provider-cadence`.

## Objective

让单站点运营者在不触发任何 Provider 请求的情况下，回答“现在应该重试还是等待”。这项工作
只把已经持久化的公开 Beta 聚合变成低噪声的节奏提示，帮助识别 SaveFromIns 的偶发限流或超时。
它不把一次失败解释为精确的上游冷却时间，也不改变现有流量、熔断和重试策略。

## Scope

- Admin Beta 健康视图支持最近 1 小时、24 小时和 7 天窗口。
- 任务、Provider 尝试和 Delivery 汇总按平台显示最近活动时间；输出仍不包含 URL、任务 ID、
  Provider 响应、认证值或媒体地址。
- 根据聚合失败类别显示“正常、观察、建议冷却、数据不足、最近无新事件”五种状态。建议冷却
  只表示窗口内瞬时失败占比偏高，文案要求暂停重复人工测试；页面没有测试 Provider 的按钮。
- SaveFromIns 诊断把底层 `AbortError` / `TimeoutError` 归为 `provider_timeout`，保持 Router
  原有的有界重试和熔断决策不变；诊断仍只记录脱敏字段。
- 不新增数据库迁移、公共 API、Provider、rollout/gate、Admin 常驻进程或校准流程。

## Design and safety notes

The Admin contract carries only aggregate counts and timestamps. Cadence is a pure presentation
derivation, so refresh remains a read-only database operation. No exact `Retry-After` value is guessed;
old samples are marked as having no recent event rather than used to justify increasing traffic.
The existing client-direct Delivery redirect is unchanged.

## Verification

- Persistence aggregation tests prove per-platform latest activity and one-hour windows without
  identifiers.
- Admin model tests cover transient-failure cooling, insufficient data, and old-window handling.
- SaveFromIns diagnostics test aborted requests as `provider_timeout` without logging raw errors.
- Admin/API contract tests continue to reject unsafe categories and preserve no-store/noindex behavior.
- Run targeted Vitest suites and `pnpm check` before PR CI.

## Release boundary

Push, merge, and production deployment require separate authorization. If released, use GitHub-built
immutable images and the existing backup → deploy → health-check loop. Admin may be started only for
an explicitly approved owner preview and must be stopped afterward. Do not perform additional
Instagram/SaveFromIns manual tests solely for this read-only change; existing X/Instagram rollout and
all Provider gates remain unchanged.
