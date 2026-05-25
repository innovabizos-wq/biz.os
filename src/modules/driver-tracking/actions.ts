"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type {
  DriverStatus,
  DriverStatusChangeInput,
} from "@/modules/driver-tracking/types";

export async function changeDriverStatusAction(input: DriverStatusChangeInput) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("upsert_estado_chofer_admin", {
    p_estado: input.status,
    p_latitude: input.latitude ?? null,
    p_longitude: input.longitude ?? null,
    p_profile_id: input.profileId,
  });

  if (error) {
    return {
      error: "No se pudo actualizar el estado del chofer.",
      ok: false as const,
    };
  }

  revalidatePath("/despacho");

  return { ok: true as const };
}

export async function updateDriverLocationAction(input: {
  latitude: number;
  longitude: number;
  profileId: string;
  status?: DriverStatus;
}) {
  return changeDriverStatusAction({
    latitude: input.latitude,
    longitude: input.longitude,
    profileId: input.profileId,
    status: input.status ?? "available",
  });
}
