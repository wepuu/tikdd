import { AdmissionControlPolicySchema, type AdmissionControlPolicy } from "./model";

export interface AdmissionControlConfiguration {
  enabled: boolean;
  policy: AdmissionControlPolicy | null;
  trustedProxyCidrs: readonly string[];
}

function parseBoolean(name: string, raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined) {
    return fallback;
  }
  if (raw !== "true" && raw !== "false") {
    throw new Error(`${name} must be true or false.`);
  }
  return raw === "true";
}

export function loadAdmissionControlConfiguration(
  environment: NodeJS.ProcessEnv = process.env
): AdmissionControlConfiguration {
  const production = environment.NODE_ENV === "production";
  const enabled = parseBoolean(
    "ADMISSION_CONTROL_ENABLED",
    environment.ADMISSION_CONTROL_ENABLED,
    production
  );
  if (production && !enabled) {
    throw new Error("ADMISSION_CONTROL_ENABLED cannot be disabled in production.");
  }

  const trustedProxyCidrs = (environment.TRUSTED_PROXY_CIDRS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (trustedProxyCidrs.length > 16) {
    throw new Error("TRUSTED_PROXY_CIDRS cannot contain more than 16 entries.");
  }

  if (!enabled) {
    return { enabled: false, policy: null, trustedProxyCidrs };
  }
  const encodedPolicy = environment.ADMISSION_CONTROL_POLICY_JSON;
  if (!encodedPolicy) {
    throw new Error("ADMISSION_CONTROL_POLICY_JSON is required when admission control is enabled.");
  }
  let rawPolicy: unknown;
  try {
    rawPolicy = JSON.parse(encodedPolicy);
  } catch {
    throw new Error("ADMISSION_CONTROL_POLICY_JSON must contain valid JSON.");
  }
  return {
    enabled: true,
    policy: AdmissionControlPolicySchema.parse(rawPolicy),
    trustedProxyCidrs
  };
}
