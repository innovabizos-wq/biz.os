import {
  DashboardAiSearch,
  type DashboardAiSearchCapabilities,
} from "@/app/(app)/dashboard/dashboard-ai-search";
import { NotificationBell } from "@/modules/notifications/components/notification-bell";
import { TimesheetSidebarWidget } from "@/modules/hr-timesheets/components/timesheet-sidebar-widget";
import type { CurrentTimesheetStatus, TimesheetState } from "@/modules/hr-timesheets/types";
import type { UserNotification } from "@/modules/notifications/types";

type AppTopHeaderProps = {
  aiSearchCapabilities: DashboardAiSearchCapabilities;
  currentTimesheetStatus: CurrentTimesheetStatus | null;
  hasHrDashboardAccess: boolean;
  hasHrRegisterAccess: boolean;
  profileName?: string | null;
  profileEmail: string | null;
  profileId: string;
  notifications: UserNotification[];
  unreadNotificationCount: number;
  timesheetStates: TimesheetState[];
};

function getFirstName(name?: string | null) {
  return name?.split(" ")[0] || "equipo";
}

export default function AppTopHeader({
  aiSearchCapabilities,
  currentTimesheetStatus,
  hasHrDashboardAccess,
  hasHrRegisterAccess,
  notifications,
  profileEmail,
  profileId,
  profileName,
  timesheetStates,
  unreadNotificationCount,
}: AppTopHeaderProps) {
  const firstName = getFirstName(profileName);

  return (
    <header className="dashboard-topbar-shell">
      <div className="dashboard-topbar-greeting">
        <h1>
          Buenos días, {firstName}!
        </h1>
        <p>
          Aquí tienes el resumen de tu negocio.
        </p>
      </div>

      <div className="dashboard-topbar-search">
        <DashboardAiSearch {...aiSearchCapabilities} />
      </div>

      <div className="dashboard-topbar-actions">
        <NotificationBell
          initialCount={unreadNotificationCount}
          notifications={notifications}
          recipientProfileId={profileId}
        />
        <TimesheetSidebarWidget
          canRegister={hasHrRegisterAccess}
          canViewDashboard={hasHrDashboardAccess}
          currentStatus={currentTimesheetStatus}
          states={timesheetStates}
          userEmail={profileEmail}
          userName={profileName}
        />
      </div>
    </header>
  );
}
