export type DriverStatus =
  | "available"
  | "on_route"
  | "lunch"
  | "paused"
  | "finished"
  | "offline"
  | "incident";

export type DispatchLogisticsStatus =
  | "pending"
  | "preparing"
  | "ready"
  | "on_route"
  | "delivered"
  | "failed"
  | "delayed"
  | "cancelled";

export type LogisticsDashboardStats = {
  connectedDrivers: number;
  availableDrivers: number;
  onRouteDrivers: number;
  lunchDrivers: number;
  pausedDrivers: number;
  pendingDispatches: number;
  deliveredToday: number;
  incidents: number;
};

export type LogisticsDaySummary = {
  dispatchesToday: number;
  effectiveness: number;
  delays: number;
};

export type LogisticsActivity = {
  id: string;
  type: string;
  title: string;
  description?: string | null;
  timeLabel: string;
  dispatchNumber?: string | null;
};

export type LogisticsDispatchRow = {
  id: string;
  number: string;
  clientName: string;
  saleNumber?: string | null;
  status: string;
  date?: string | null;
  responsibleId?: string | null;
  responsibleName?: string | null;
  contactName?: string | null;
  phone?: string | null;
};

export type LogisticsResponsibleOption = {
  id: string;
  name: string;
};

export type LogisticsDispatchFilters = {
  search?: string;
  estado?: string;
  responsableId?: string;
  fecha?: string;
};

export type LogisticsDashboardData = {
  stats: LogisticsDashboardStats;
  summary: LogisticsDaySummary;
  activities: LogisticsActivity[];
  dispatches: LogisticsDispatchRow[];
  responsibleOptions: LogisticsResponsibleOption[];
  totalDispatches: number;
};
