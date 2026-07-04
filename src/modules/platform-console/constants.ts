export const PLATFORM_CONSOLE_ROLES = [
  "owner",
  "admin",
  "support",
  "operator",
  "readonly",
] as const;

export const PLATFORM_CONSOLE_STATUSES = ["active", "inactive"] as const;

export const PLATFORM_ROLE_LABELS = {
  admin: "Admin",
  operator: "Operator",
  owner: "Owner",
  readonly: "Read only",
  support: "Support",
} as const;

export const PLATFORM_NAV_ITEMS = [
  { href: "/platform", label: "Resumen" },
  { href: "/platform/empresas", label: "Empresas" },
  { href: "/platform/whapp", label: "Whapp" },
  { href: "/platform/health", label: "Health" },
  { href: "/platform/soporte", label: "Soporte" },
] as const;

