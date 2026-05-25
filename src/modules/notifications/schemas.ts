import { z } from "zod";

import { NOTIFICATION_TYPES } from "@/modules/notifications/constants";

export const markNotificationReadSchema = z.object({
  notificationId: z.string().uuid(),
});

export const createOwnNotificationSchema = z.object({
  entityId: z.string().uuid().optional().nullable(),
  entityType: z.string().trim().max(80).optional().nullable(),
  href: z.string().trim().max(300).optional().nullable(),
  message: z.string().trim().max(500).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  title: z.string().trim().min(1).max(120),
  type: z.enum(NOTIFICATION_TYPES),
});
