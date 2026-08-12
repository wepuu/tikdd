import { type ResolveJobData } from "@tikdd/contracts";
import { detectPlatform } from "@tikdd/platform";

type PlatformDetection = ReturnType<typeof detectPlatform>;

export class ResolveJobPlatformMismatchError extends Error {
  readonly code = "PLATFORM_MISMATCH";

  constructor() {
    super("The queued platform no longer matches the submitted URL.");
    this.name = "ResolveJobPlatformMismatchError";
  }
}

export function verifyResolveJobPlatform(
  data: Pick<ResolveJobData, "sourceUrl" | "platform">,
  detect: (url: string) => PlatformDetection = detectPlatform
): PlatformDetection {
  const detected = detect(data.sourceUrl);
  if (detected.platform !== data.platform) {
    throw new ResolveJobPlatformMismatchError();
  }
  return detected;
}
