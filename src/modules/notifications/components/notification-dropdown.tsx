"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/modules/notifications/actions";
import { NotificationItem } from "@/modules/notifications/components/notification-item";
import type { UserNotification } from "@/modules/notifications/types";

type NotificationDropdownProps = {
  isBusy: boolean;
  notifications: UserNotification[];
  onAllRead: () => void;
  onAnyRead: (notificationId: string) => void;
  onBusyChange: (isBusy: boolean) => void;
  onSoundPreferenceChange: (enabled: boolean) => void;
  soundEnabled: boolean;
};

export function NotificationDropdown({
  isBusy,
  notifications,
  onAllRead,
  onAnyRead,
  onBusyChange,
  onSoundPreferenceChange,
  soundEnabled,
}: NotificationDropdownProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const hasUnread = notifications.some((item) => !item.isRead);
  const disabled = isBusy || isPending;

  function markLocallyAsRead(notification: UserNotification) {
    if (notification.isRead) return false;

    onAnyRead(notification.id);

    return true;
  }

  function handleMarkRead(notification: UserNotification) {
    onBusyChange(true);
    startTransition(async () => {
      try {
        if (markLocallyAsRead(notification)) {
          await markNotificationReadAction({ notificationId: notification.id });
        }
      } finally {
        onBusyChange(false);
      }
    });
  }

  function handleView(notification: UserNotification) {
    onBusyChange(true);
    startTransition(async () => {
      try {
        if (markLocallyAsRead(notification)) {
          await markNotificationReadAction({ notificationId: notification.id });
        }
        if (notification.href) {
          router.push(notification.href);
        }
      } finally {
        onBusyChange(false);
      }
    });
  }

  function handleMarkAll() {
    onBusyChange(true);
    startTransition(async () => {
      try {
        onAllRead();
        await markAllNotificationsReadAction();
        router.refresh();
      } finally {
        onBusyChange(false);
      }
    });
  }

  return (
    <div className="absolute right-0 top-12 z-50 w-[min(calc(100vw-2rem),380px)] overflow-hidden rounded-xl border bg-background shadow-xl">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <p className="text-sm font-semibold">Notificaciones</p>
          <p className="text-xs text-muted-foreground">Actividad reciente para tu usuario</p>
        </div>
        <button
          aria-label="Marcar todas las notificaciones como leidas"
          className="text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
          disabled={!hasUnread || disabled}
          onClick={handleMarkAll}
          type="button"
        >
          Marcar todas
        </button>
      </div>
      <div className="flex items-center justify-between gap-3 border-b bg-muted/30 px-4 py-2 text-xs">
        <span className="font-medium text-muted-foreground">
          Zumbido de notificaciones
        </span>
        <button
          className="rounded-full border bg-background px-2.5 py-1 font-semibold text-foreground hover:bg-muted"
          onClick={() => onSoundPreferenceChange(!soundEnabled)}
          type="button"
        >
          {soundEnabled ? "Activado" : "Desactivado"}
        </button>
      </div>
      <div className="max-h-[420px] overflow-auto">
        {notifications.length > 0 ? (
          notifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onMarkRead={handleMarkRead}
              onView={handleView}
            />
          ))
        ) : (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            No tienes notificaciones.
          </div>
        )}
      </div>
    </div>
  );
}
