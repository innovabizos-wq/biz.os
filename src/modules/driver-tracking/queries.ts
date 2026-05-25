import { createClient } from "@/lib/supabase/server";
import { EMPTY_DRIVER_TRACKING_SUMMARY } from "@/modules/driver-tracking/constants";
import type {
  DriverStatus,
  DriverTrackingSummary,
  LiveDriver,
} from "@/modules/driver-tracking/types";
import type { CoreResult } from "@/types/core";
import { ok } from "@/types/core";

type LiveDriverRow = {
  profile_id: string;
  nombre: string | null;
  correo: string | null;
  estado: DriverStatus;
  latitude: number | string | null;
  longitude: number | string | null;
  accuracy: number | string | null;
  speed: number | string | null;
  heading: number | string | null;
  battery_level: number | string | null;
  last_seen_at: string | null;
  tracking_enabled: boolean | null;
  is_online: boolean | null;
  current_dispatch_id: string | null;
};

type DriverSummaryRow = {
  connected_drivers: number | null;
  available_drivers: number | null;
  on_route_drivers: number | null;
  lunch_drivers: number | null;
  paused_drivers: number | null;
  incident_drivers: number | null;
  offline_drivers: number | null;
};

function toNumber(value: number | string | null) {
  if (value === null) return null;
  const parsed = typeof value === "number" ? value : Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function mapLiveDriver(row: LiveDriverRow): LiveDriver {
  return {
    accuracy: toNumber(row.accuracy),
    batteryLevel: toNumber(row.battery_level),
    currentDispatchId: row.current_dispatch_id,
    email: row.correo ?? "",
    heading: toNumber(row.heading),
    isOnline: Boolean(row.is_online),
    lastSeenAt: row.last_seen_at,
    latitude: toNumber(row.latitude),
    longitude: toNumber(row.longitude),
    name: row.nombre ?? row.correo ?? "Chofer",
    profileId: row.profile_id,
    speed: toNumber(row.speed),
    status: row.estado,
    trackingEnabled: Boolean(row.tracking_enabled),
  };
}

function mapSummary(row: DriverSummaryRow | null): DriverTrackingSummary {
  if (!row) {
    return EMPTY_DRIVER_TRACKING_SUMMARY;
  }

  return {
    availableDrivers: row.available_drivers ?? 0,
    connectedDrivers: row.connected_drivers ?? 0,
    incidentDrivers: row.incident_drivers ?? 0,
    lunchDrivers: row.lunch_drivers ?? 0,
    offlineDrivers: row.offline_drivers ?? 0,
    onRouteDrivers: row.on_route_drivers ?? 0,
    pausedDrivers: row.paused_drivers ?? 0,
  };
}

function logDriverTrackingDiagnostic(
  reason: string,
  context: Record<string, unknown>,
) {
  if (process.env.NODE_ENV !== "production") {
    console.info(`[driverTracking] ${reason}`, context);
  }
}

export async function getLiveDrivers(): Promise<CoreResult<LiveDriver[]>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("obtener_choferes_en_vivo");

    if (error) {
      logDriverTrackingDiagnostic("live drivers query failed", {
        message: error.message,
      });
      return ok([]);
    }

    return ok(((data ?? []) as LiveDriverRow[]).map(mapLiveDriver));
  } catch (error) {
    logDriverTrackingDiagnostic("live drivers query threw", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return ok([]);
  }
}

export async function getDriverTrackingSummary(): Promise<
  CoreResult<DriverTrackingSummary>
> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc(
      "obtener_resumen_choferes_en_vivo",
    );

    if (error) {
      logDriverTrackingDiagnostic("driver summary query failed", {
        message: error.message,
      });
      return ok(EMPTY_DRIVER_TRACKING_SUMMARY);
    }

    const rows = (data ?? []) as DriverSummaryRow[];

    return ok(mapSummary(rows[0] ?? null));
  } catch (error) {
    logDriverTrackingDiagnostic("driver summary query threw", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return ok(EMPTY_DRIVER_TRACKING_SUMMARY);
  }
}
