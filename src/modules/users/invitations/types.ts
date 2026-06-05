import type { Sucursal, Rol } from "@/types/core";

export type InvitacionEstado =
  | "pendiente"
  | "aceptada"
  | "cancelada"
  | "expirada";

export type UserInvitation = {
  aceptadaAt: string | null;
  cargo: string | null;
  canceladaAt: string | null;
  cedula: string | null;
  correo: string;
  createdAt: string;
  estado: InvitacionEstado;
  fechaExpiracion: string;
  id: string;
  nombre: string;
  rol: Pick<Rol, "id" | "nombre"> | null;
  sucursal: Pick<Sucursal, "id" | "nombre"> | null;
  telefono: string | null;
  token: string;
};

export type CreatedInvitation = {
  correo: string;
  fechaExpiracion: string;
  id: string;
  invitationUrl: string;
  token: string;
};
