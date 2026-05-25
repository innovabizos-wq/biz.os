"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/modules/notifications/actions";
import { NotificationItem } from "@/modules/notifications/components/notification-item";
import type { UserNotification } from "@/modules/notifications/types";

type NotificationDropdownProps = {
  notifications: UserNotification[];
  onAllRead: () => void;
  onAnyRead: () => void;
};

export function NotificationDropdown({
  notifications,
  onAllRead,
  onAnyRead,
}: NotificationDropdownProps) {
  const router = useRouter();
  const [items, setItems] = useState(notifications);
  const [isPending, startTransition] = useTransition();
  const hasUnread = items.some((item) => !item.isRead);

  function markLocallyAsRead(notification: UserNotification) {
    if (notification.isRead) return false;

    setItems((current) =>
      current.map((item) =>
        item.id === notification.id
          ? { ...item, isRead: true, readAt: new Date().toISOString() }
          : item,
      ),
    );
    onAnyRead();

    return true;
  }

  function handleMarkRead(notification: UserNotification) {
    startTransition(async () => {
      if (markLocallyAsRead(notification)) {
        await markNotificationReadAction({ notificationId: notification.id });
      }
    });
  }

  function handleView(notification: UserNotification) {
    startTransition(async () => {
      if (markLocallyAsRead(notification)) {
        await markNotificationReadAction({ notificationId: notification.id });
      }
      if (notification.href) {
        router.push(notification.href);
      }
    });
  }

  function handleMarkAll() {
    startTransition(async () => {
      setItems((current) =>
        current.map((item) => ({
          ...item,
          isRead: true,
          readAt: item.readAt ?? new Date().toISOString(),
        })),
      );
      onAllRead();
      await markAllNotificationsReadAction();
      router.refresh();
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
          className="text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
          disabled={!hasUnread || isPending}
          onClick={handleMarkAll}
          type="button"
        >
          Marcar todas
        </button>
      </div>
      <div className="max-h-[420px] overflow-auto">
        {items.length > 0 ? (
          items.map((notification) => (
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
