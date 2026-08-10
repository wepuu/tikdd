import { ResolveTaskSchema, type ResolveTask } from "@tikdd/contracts";

export function toPublicResolveTask(task: ResolveTask): ResolveTask {
  if (!task.result) return ResolveTaskSchema.parse(task);

  return ResolveTaskSchema.parse({
    ...task,
    result: {
      ...task.result,
      provenance: {
        provider: "tikdd",
        kind: "api",
        cacheHit: false,
        resolvedAt: task.result.provenance.resolvedAt
      },
      warnings: []
    }
  });
}
