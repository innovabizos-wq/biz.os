import { redirect } from "next/navigation";

import { AppSidebarNav } from "@/components/navigation/app-sidebar-nav";
import { SidebarBrandLogo } from "@/components/navigation/sidebar-brand-logo";
import { getCurrentTenantContext, getCurrentUser } from "@/lib/auth/session";
import { hasAnyPermission, hasPermission } from "@/lib/permissions/permission-checks";
import { isModuleActive } from "@/lib/platform-modules/module-checks";
import { FloatingConsultationButton } from "@/modules/consultations/components/floating-consultation-button";
import { TimesheetSidebarWidget } from "@/modules/hr-timesheets/components/timesheet-sidebar-widget";
import {
  getActiveTimesheetStates,
  getCurrentTimesheetStatus,
} from "@/modules/hr-timesheets/queries";
import { FloatingInboxButton } from "@/modules/inbox-widget/components/floating-inbox-button";
import { getInboxWidgetConversations } from "@/modules/inbox-widget/queries";
import { NotificationBell } from "@/modules/notifications/components/notification-bell";
import {
  getMyNotifications,
  getMyUnreadNotificationCount,
} from "@/modules/notifications/queries";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AppShell>{children}</AppShell>;
}

async function AppShell({ children }: { children: React.ReactNode }) {
  const userResult = await getCurrentUser();

  if (!userResult.ok || !userResult.data) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[appLayout] missing authenticated user", {
        reason: userResult.ok ? "no-user" : userResult.error.message,
      });
    }
    redirect("/login");
  }

  const tenantResult = await getCurrentTenantContext();

  if (!tenantResult.ok) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[appLayout] tenant context failed", {
        code: tenantResult.error.code,
        message: tenantResult.error.message,
      });
    }
    redirect("/login");
  }

  if (!tenantResult.data) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[appLayout] tenant context missing; redirect onboarding");
    }
    redirect("/onboarding");
  }

  const tenant = tenantResult.data;
  const showCrm =
    isModuleActive(tenant.activeModules, "crm") &&
    hasAnyPermission(tenant.permissions, [
      "crm.customers.view",
      "crm.customers.create",
      "crm.customers.edit",
      "crm.interactions.view",
      "crm.interactions.create",
      "crm.followups.view",
      "crm.followups.create",
      "crm.followups.edit",
    ]);
  const showNewConsultation = hasPermission(
    tenant.permissions,
    "crm.customers.view",
  );
  const canCreateConsultationCustomer = hasPermission(
    tenant.permissions,
    "crm.customers.create",
  );
  const canSaveConsultationInteraction = hasPermission(
    tenant.permissions,
    "crm.interactions.create",
  );
  const showAgenda =
    isModuleActive(tenant.activeModules, "crm") &&
    hasPermission(tenant.permissions, "crm.followups.view");
  const showQuotes =
    isModuleActive(tenant.activeModules, "quotes") &&
    hasAnyPermission(tenant.permissions, [
      "quotes.view",
      "quotes.create",
      "quotes.edit",
    ]);
  const canCreateQuote = hasPermission(tenant.permissions, "quotes.create");
  const showCatalog =
    isModuleActive(tenant.activeModules, "catalog") &&
    hasAnyPermission(tenant.permissions, [
      "catalog.products.view",
      "catalog.products.create",
      "catalog.products.edit",
      "catalog.categories.view",
    ]);
  const showSales =
    isModuleActive(tenant.activeModules, "sales") &&
    hasAnyPermission(tenant.permissions, [
      "sales.orders.view",
      "sales.orders.create",
      "sales.orders.edit",
    ]);
  const showInventory =
    isModuleActive(tenant.activeModules, "inventory") &&
    hasAnyPermission(tenant.permissions, [
      "inventory.stock.view",
      "inventory.stock.adjust",
      "inventory.movements.view",
      "inventory.warehouses.view",
      "inventory.warehouses.manage",
    ]);
  const showDispatch =
    isModuleActive(tenant.activeModules, "dispatch") &&
    hasAnyPermission(tenant.permissions, [
      "dispatch.orders.view",
      "dispatch.orders.create",
      "dispatch.orders.edit",
    ]);
  const showInbox =
    isModuleActive(tenant.activeModules, "whapp") &&
    hasAnyPermission(tenant.permissions, [
      "inbox.conversations.view",
      "inbox.conversations.reply",
      "inbox.channels.view",
    ]);
  const showAutoblog =
    isModuleActive(tenant.activeModules, "autoblog") &&
    hasAnyPermission(tenant.permissions, [
      "autoblog.view",
      "autoblog.manage",
    ]);
  const showHr =
    isModuleActive(tenant.activeModules, "hr") &&
    hasAnyPermission(tenant.permissions, [
      "hr.timesheets.view",
      "hr.timesheets.manage",
      "hr.timesheets.register",
      "hr.timesheets.dashboard",
      "hr.timesheets.states.manage",
    ]);
  const showHrRegister =
    showHr && hasPermission(tenant.permissions, "hr.timesheets.register");
  const showHrDashboard =
    showHr &&
    hasAnyPermission(tenant.permissions, [
      "hr.timesheets.dashboard",
      "hr.timesheets.view",
      "hr.timesheets.manage",
    ]);
  const showHrStates =
    showHr && hasPermission(tenant.permissions, "hr.timesheets.states.manage");
  const showAdminSettings = hasAnyPermission(tenant.permissions, [
    "admin.settings.view",
    "admin.settings.manage",
  ]);
  const showAdminUsers = hasAnyPermission(tenant.permissions, [
    "admin.users.view",
    "admin.users.manage",
  ]);
  const showAdminRoles = hasAnyPermission(tenant.permissions, [
    "admin.roles.view",
    "admin.roles.manage",
  ]);
  const showAdmin = showAdminSettings || showAdminUsers || showAdminRoles;
  const [
    currentTimesheetStatus,
    activeTimesheetStates,
    notificationsResult,
    unreadNotificationsResult,
    inboxWidgetConversationsResult,
  ] = await Promise.all([
    showHr
      ? getCurrentTimesheetStatus()
      : Promise.resolve({ data: null, error: null, ok: true as const }),
    showHr
      ? getActiveTimesheetStates()
      : Promise.resolve({ data: [], error: null, ok: true as const }),
    getMyNotifications({ limit: 20 }),
    getMyUnreadNotificationCount(),
    showInbox
      ? getInboxWidgetConversations()
      : Promise.resolve({ data: [], error: null, ok: true as const }),
  ]);

  return (
    <div className="grid min-h-screen max-w-screen overflow-hidden bg-muted lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="app-sidebar-shell hidden border-r p-6 lg:block">
        <div className="flex min-h-[calc(100vh-3rem)] flex-col gap-6">
          <SidebarBrandLogo />
          <AppSidebarNav
            showAdmin={Boolean(showAdmin)}
            showAgenda={Boolean(showAgenda)}
            showAutoblog={Boolean(showAutoblog)}
            showCatalog={Boolean(showCatalog)}
            showCrm={Boolean(showCrm)}
            showDispatch={Boolean(showDispatch)}
            showHr={Boolean(showHr)}
            showHrDashboard={Boolean(showHrDashboard)}
            showHrStates={Boolean(showHrStates)}
            showInbox={Boolean(showInbox)}
            showInventory={Boolean(showInventory)}
            showQuotes={Boolean(showQuotes)}
            showSales={Boolean(showSales)}
          />
        </div>
      </aside>

      <div className="flex min-w-0 max-w-full flex-col overflow-hidden">
        <main className="flex-1 p-6">{children}</main>
      </div>
      <NotificationBell
        className="app-notification-topbar"
        initialCount={unreadNotificationsResult.ok ? unreadNotificationsResult.data : 0}
        notifications={notificationsResult.ok ? notificationsResult.data : []}
        recipientProfileId={tenant.profileId}
      />
      <div className="app-session-topbar">
        <TimesheetSidebarWidget
          canRegister={Boolean(showHrRegister)}
          canViewDashboard={Boolean(showHrDashboard)}
          currentStatus={currentTimesheetStatus.ok ? currentTimesheetStatus.data : null}
          states={activeTimesheetStates.ok ? activeTimesheetStates.data : []}
          userEmail={tenant.profileEmail ?? userResult.data.email}
          userName={tenant.profileName}
        />
      </div>
      {showInbox ? (
        <FloatingInboxButton
          conversations={
            inboxWidgetConversationsResult.ok
              ? inboxWidgetConversationsResult.data
              : []
          }
        />
      ) : null}
      {showCrm ? (
        showNewConsultation ? (
          <FloatingConsultationButton
            canCreateCustomer={canCreateConsultationCustomer}
            canCreateQuote={canCreateQuote}
            canSaveInteraction={canSaveConsultationInteraction}
          />
        ) : null
      ) : null}
    </div>
  );
}
