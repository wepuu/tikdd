import type { AdminContentPublicationView } from "@tikdd/admin-contracts";

export type PublicationWriteMode = "content-draft" | "full";

export function publicationStepLabel(state: AdminContentPublicationView["propagationState"] | undefined): string {
  switch (state) {
    case "propagating": return "传播中";
    case "propagated": return "已确认";
    case "propagation_failed": return "确认失败";
    case "idle": return "尚未发布";
    default: return "不可用";
  }
}

export function canPublishSnapshot(input: {
  writeMode: PublicationWriteMode;
  publication: AdminContentPublicationView | null;
  confirmation: string;
}): boolean {
  const { writeMode, publication, confirmation } = input;
  return writeMode === "full" && Boolean(
    publication &&
    publication.blockers.length === 0 &&
    publication.propagationState !== "propagating" &&
    publication.diff.length > 0 &&
    confirmation.trim() === publication.deployment
  );
}

export function publicationGuidance(input: {
  writeMode: PublicationWriteMode;
  publication: AdminContentPublicationView | null;
  confirmation: string;
}): string {
  const { writeMode, publication, confirmation } = input;
  if (writeMode !== "full") return "当前为内容草稿模式；切换到 full 后才能发布、重试或回滚。";
  if (!publication) return "发布状态暂不可用，请先恢复 Admin API。";
  if (publication.propagationState === "propagating") return "已有快照正在传播，请等待传播确认。";
  if (publication.blockers.length > 0) return `当前有 ${publication.blockers.length} 个发布阻塞，请先处理。`;
  if (publication.diff.length === 0) return "当前没有待发布差异，无需重复发布。";
  if (confirmation.trim() !== publication.deployment) return `请输入 ${publication.deployment} 以确认发布。`;
  return "发布前检查通过，可以发布一个不可变快照。";
}
