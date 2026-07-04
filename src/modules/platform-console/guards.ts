import { cache } from "react";
import { notFound } from "next/navigation";

import { getCurrentProfile, getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { PlatformRole, PlatformUser } from "@/modules/platform-console/types";
import type { CoreResult } from "@/types/core";
import { fail, ok } from "@/types/core";

type PlatformUserRow = {
  created_at: string;
  id: string;
  notes: string | null;
  profile_id: string;
  role: PlatformRole;
  status: PlatformUser["status"];
};

function mapPlatformUser(row: PlatformUserRow, profile: {
  correo: string;
  nombre: string;
}): PlatformUser {
  return {
    createdAt: row.created_at,
    email: profile.correo,
    id: row.id,
    name: profile.nombre,
    notes: row.notes,
    profileId: row.profile_id,
    role: row.role,
    status: row.status,
  };
}

export const getCurrentPlatformUser = cache(async function getCurrentPlatformUser(): Promise<
  CoreResult<PlatformUser | null>
> {
  const [userResult, profileResult] = await Promise.all([
    getCurrentUser(),
    getCurrentProfile(),
  ]);

  if (!userResult.ok) return userResult;
  if (!userResult.data) return ok(null);
  if (!profileResult.ok) return profileResult;
  if (!profileResult.data) return ok(null);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("platform_users")
    .select("id, profile_id, role, status, notes, created_at")
    .eq("profile_id", userResult.data.id)
    .eq("status", "active")
    .maybeSingle<PlatformUserRow>();

  if (error) {
    return fail(
      "PERMISSION_DENIED",
      "No se pudo validar acceso a Platform Console.",
      error,
    );
  }

  if (!data) return ok(null);

  return ok(
    mapPlatformUser(data, {
      correo: profileResult.data.correo,
      nombre: profileResult.data.nombre,
    }),
  );
});

export async function requirePlatformAccess(
  allowedRoles?: readonly PlatformRole[],
): Promise<PlatformUser> {
  const platformUser = await getCurrentPlatformUser();

  if (!platformUser.ok || !platformUser.data) {
    notFound();
  }

  if (
    allowedRoles &&
    allowedRoles.length > 0 &&
    !allowedRoles.includes(platformUser.data.role)
  ) {
    notFound();
  }

  return platformUser.data;
}

