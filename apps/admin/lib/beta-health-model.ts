import type { AdminBetaHealth } from "@tikdd/admin-contracts";

type BetaBucket = AdminBetaHealth["totals"];

export function hasObservedDownloadActivity(bucket: BetaBucket): boolean {
  return bucket.latestEventAt !== null
    || bucket.tasks.total > 0
    || bucket.attempts.total > 0
    || bucket.deliveries.total > 0
    || bucket.deliveries.ticketCount > 0
    || bucket.deliveries.handoffCount > 0;
}

/** Downloads is an event workspace, not a capability catalog. Hide empty platform cards here. */
export function visibleDownloadPlatforms(report: AdminBetaHealth): string[] {
  return report.platforms.filter((platform) => {
    const bucket = report.byPlatform[platform];
    return bucket ? hasObservedDownloadActivity(bucket) : false;
  });
}
