import type {
  DriverStatus,
  DriverTrackingSummary,
} from "@/modules/driver-tracking/types";

export const DRIVER_STATUSES = [
  "available",
  "on_route",
  "lunch",
  "paused",
  "finished",
  "offline",
  "incident",
] as const satisfies readonly DriverStatus[];

export const EMPTY_DRIVER_TRACKING_SUMMARY: DriverTrackingSummary = {
  availableDrivers: 0,
  connectedDrivers: 0,
  incidentDrivers: 0,
  lunchDrivers: 0,
  offlineDrivers: 0,
  onRouteDrivers: 0,
  pausedDrivers: 0,
};

export const DRIVER_STATUS_LABELS: Record<DriverStatus, string> = {
  available: "Disponible",
  finished: "Finalizado",
  incident: "Incidencia",
  lunch: "Almuerzo",
  offline: "Sin conexion",
  on_route: "En ruta",
  paused: "Pausa",
};
