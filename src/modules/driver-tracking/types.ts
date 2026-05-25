export type DriverStatus =
  | "available"
  | "on_route"
  | "lunch"
  | "paused"
  | "finished"
  | "offline"
  | "incident";

export type LiveDriver = {
  profileId: string;
  name: string;
  email: string;
  status: DriverStatus;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  batteryLevel: number | null;
  lastSeenAt: string | null;
  trackingEnabled: boolean;
  isOnline: boolean;
  currentDispatchId: string | null;
};

export type DriverTrackingSummary = {
  connectedDrivers: number;
  availableDrivers: number;
  onRouteDrivers: number;
  lunchDrivers: number;
  pausedDrivers: number;
  incidentDrivers: number;
  offlineDrivers: number;
};

export type DriverStatusChangeInput = {
  profileId: string;
  status: DriverStatus;
  latitude?: number | null;
  longitude?: number | null;
};
