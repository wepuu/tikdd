export type AdminWorkspace = "overview" | "content" | "providers" | "settings";

export const ADMIN_WORKSPACES: ReadonlyArray<{
  id: AdminWorkspace;
  label: string;
  detail: string;
  icon: "home" | "content" | "providers" | "settings";
}> = [
  { id: "overview", label: "概览", detail: "今天和告警", icon: "home" },
  { id: "content", label: "内容", detail: "编辑与发布", icon: "content" },
  { id: "providers", label: "Providers", detail: "能力与路由", icon: "providers" },
  { id: "settings", label: "设置", detail: "站点与账号", icon: "settings" }
];

/**
 * Keep deep links from the previous long-form console working while the UI
 * moves to four focused workspaces.
 */
export const LEGACY_WORKSPACE_MAP: Readonly<Record<string, AdminWorkspace>> = {
  "operational-truth": "providers",
  "beta-health": "providers",
  routing: "providers",
  coverage: "providers",
  platforms: "providers",
  qualification: "providers",
  publishing: "content",
  "seo-readiness": "content",
  "publication-center": "content",
  growth: "content",
  "publishing-readiness": "content",
  runtime: "settings",
  "site-integrations": "settings",
  "account-security": "settings"
};

export function workspaceFromHash(value: string | undefined): AdminWorkspace {
  const hash = (value ?? "").replace(/^#/, "");
  if (ADMIN_WORKSPACES.some((workspace) => workspace.id === hash)) {
    return hash as AdminWorkspace;
  }
  return LEGACY_WORKSPACE_MAP[hash] ?? "overview";
}
