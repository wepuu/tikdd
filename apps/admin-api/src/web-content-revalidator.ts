import { createHmac } from "node:crypto";
import { PublicContentRevalidationAcknowledgementSchema, PublicContentRevalidationCommandSchema } from "@tikdd/admin-contracts";

export interface WebContentRevalidatorOptions { origin: string | null; secret: string | null; timeoutMs?: number; fetcher?: typeof fetch }

export class WebContentRevalidator {
  constructor(private readonly options: WebContentRevalidatorOptions) {}
  async revalidate(paths: readonly string[], snapshotId: string) {
    if (!this.options.origin || !this.options.secret || this.options.secret.length < 32 || paths.length > 100) return false;
    try {
      const command = PublicContentRevalidationCommandSchema.parse({ schemaVersion: "1", snapshotId, paths });
      const body = JSON.stringify(command);
      const timestamp = String(Date.now());
      const signature = createHmac("sha256", this.options.secret).update(`${timestamp}.${body}`).digest("hex");
      const response = await (this.options.fetcher ?? fetch)(new URL("/api/internal/content/revalidate", this.options.origin), {
        method: "POST", redirect: "error", headers: { "content-type": "application/json", "x-tikdd-content-timestamp": timestamp, "x-tikdd-content-signature": signature }, body,
        signal: AbortSignal.timeout(this.options.timeoutMs ?? 4_000)
      });
      if (!response.ok) return false;
      const acknowledgement = PublicContentRevalidationAcknowledgementSchema.parse(await response.json());
      return acknowledgement.snapshotId === snapshotId;
    } catch { return false; }
  }
}
