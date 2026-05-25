import type { AuthenticatedProfile, TenantContext } from "@/types/core";

export type AuthSession = {
  email?: string;
  userId: string;
};

export type AuthUser = {
  email: string | null;
  id: string;
};

export type AuthState = {
  user: AuthUser | null;
  profile: AuthenticatedProfile | null;
  session: AuthSession | null;
  tenantContext: TenantContext | null;
};
