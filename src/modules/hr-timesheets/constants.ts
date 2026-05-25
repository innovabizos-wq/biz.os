import type { TimesheetStateType } from "@/modules/hr-timesheets/types";

export const TIMESHEET_STATE_TYPES = [
  "entrada",
  "salida",
  "pausa",
  "regreso",
  "almuerzo",
  "break",
  "descanso_activo",
  "operativo",
  "personalizado",
] as const satisfies readonly TimesheetStateType[];

export const TIMESHEET_QUICK_STATE_CODES = [
  "login",
  "almuerzo",
  "regreso_almuerzo",
  "pausa",
  "regreso_pausa",
  "salida",
] as const;

export const TIMESHEET_STATE_TYPE_LABELS: Record<TimesheetStateType, string> = {
  almuerzo: "Almuerzo",
  break: "Break",
  descanso_activo: "Descanso activo",
  entrada: "Entrada",
  operativo: "Operativo",
  pausa: "Pausa",
  personalizado: "Personalizado",
  regreso: "Regreso",
  salida: "Salida",
};
