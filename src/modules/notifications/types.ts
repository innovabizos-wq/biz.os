import type { JsonRecord } from "@/types/core";

export type NotificationType =
  | "info"
  | "success"
  | "warning"
  | "error"
  | "task"
  | "crm"
  | "quote"
  | "sale"
  | "dispatch"
  | "inventory"
  | "system";

export type UserNotification = {
  actorName: string | null;
  createdAt: string;
  entityId: string | null;
  entityType: string | null;
  href: string | null;
  id: string;
  isRead: boolean;
  message: string | null;
  metadata: JsonRecord;
  readAt: string | null;
  title: string;
  type: NotificationType;
};
