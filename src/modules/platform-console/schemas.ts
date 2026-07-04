import { z } from "zod";

import {
  PLATFORM_CONSOLE_ROLES,
  PLATFORM_CONSOLE_STATUSES,
} from "@/modules/platform-console/constants";

export const platformRoleSchema = z.enum(PLATFORM_CONSOLE_ROLES);
export const platformUserStatusSchema = z.enum(PLATFORM_CONSOLE_STATUSES);

export const platformUserRowSchema = z.object({
  created_at: z.string(),
  id: z.string().uuid(),
  notes: z.string().nullable(),
  profile_id: z.string().uuid(),
  role: platformRoleSchema,
  status: platformUserStatusSchema,
});

