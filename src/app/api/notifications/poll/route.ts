import { getCurrentProfile, getCurrentTenantContext } from "@/lib/auth/session";
import { createDueFollowupReminderNotifications } from "@/modules/notifications/followup-reminders";
import { getMyNotifications, getMyUnreadNotificationCount } from "@/modules/notifications/queries";
import { getNotificationSettings } from "@/modules/notifications/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const [tenantResult, profileResult] = await Promise.all([
    getCurrentTenantContext(),
    getCurrentProfile(),
  ]);

  if (!tenantResult.ok || !tenantResult.data || !profileResult.ok || !profileResult.data) {
    return Response.json(
      {
        notifications: [],
        serverTime: new Date().toISOString(),
        unreadCount: 0,
      },
      {
        headers: { "Cache-Control": "no-store" },
        status: 401,
      },
    );
  }

  const settings = await getNotificationSettings(tenantResult.data);

  await createDueFollowupReminderNotifications({
    leadMinutes: settings.ok ? settings.data.followupReminderLeadMinutes : 30,
    profileId: profileResult.data.id,
    tenant: tenantResult.data,
  });

  const [notificationsResult, unreadCountResult] = await Promise.all([
    getMyNotifications({ limit: 20 }),
    getMyUnreadNotificationCount(),
  ]);

  return Response.json(
    {
      notifications: notificationsResult.ok ? notificationsResult.data : [],
      serverTime: new Date().toISOString(),
      unreadCount: unreadCountResult.ok ? unreadCountResult.data : 0,
    },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}
