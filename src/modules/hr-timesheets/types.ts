export type TimesheetStateType =
  | "entrada"
  | "salida"
  | "pausa"
  | "regreso"
  | "almuerzo"
  | "break"
  | "descanso_activo"
  | "operativo"
  | "personalizado";

export type TimesheetState = {
  active: boolean;
  code: string;
  color: string | null;
  countsAsBreak: boolean;
  countsAsWork: boolean;
  createdAt: string;
  description: string | null;
  id: string;
  isFinalState: boolean;
  isInitialState: boolean;
  isSystem: boolean;
  name: string;
  order: number;
  requiresReturn: boolean;
  returnStateCode: string | null;
  type: TimesheetStateType;
  updatedAt: string;
};

export type CurrentTimesheetStatus = {
  canRegister: boolean;
  date: string | null;
  durationMinutes: number | null;
  profileId: string;
  registeredAt: string | null;
  stateCode: string | null;
  stateName: string | null;
};

export type TimesheetEvent = {
  createdAt: string;
  date: string;
  id: string;
  notes: string | null;
  origin: string;
  profileId: string;
  profileName: string | null;
  registeredAt: string;
  stateCode: string;
  stateName: string;
};

export type TimesheetDashboardRow = {
  alert: string | null;
  currentState: string;
  email: string;
  eventsCount: number;
  firstLogin: string | null;
  lastLogout: string | null;
  minutesInState: number | null;
  name: string;
  profileId: string;
  since: string | null;
};
