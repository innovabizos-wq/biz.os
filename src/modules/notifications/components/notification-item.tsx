"use client";

import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  Package,
  ShoppingCart,
  Truck,
} from "lucide-react";

import type { UserNotification } from "@/modules/notifications/types";
import { cn } from "@/lib/utils";

type NotificationItemProps = {
  notification: UserNotification;
  onMarkRead: (notification: UserNotification) => void;
  onView: (notification: UserNotification) => void;
};

function formatNotificationDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("es-CR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  }).format(date);
}

function renderNotificationIcon(type: UserNotification["type"]) {
  if (type === "success") return <CheckCircle2 aria-hidden="true" size={16} />;
  if (type === "warning") return <AlertTriangle aria-hidden="true" size={16} />;
  if (type === "error") return <CircleAlert aria-hidden="true" size={16} />;
  if (type === "task" || type === "crm" || type === "quote") {
    return <ClipboardList aria-hidden="true" size={16} />;
  }
  if (type === "sale") return <ShoppingCart aria-hidden="true" size={16} />;
  if (type === "dispatch") return <Truck aria-hidden="true" size={16} />;
  if (type === "inventory") return <Package aria-hidden="true" size={16} />;

  return <Bell aria-hidden="true" size={16} />;
}

export function NotificationItem({
  notification,
  onMarkRead,
  onView,
}: NotificationItemProps) {
  return (
    <div
      className={cn(
        "flex w-full cursor-pointer gap-3 border-b px-4 py-3 text-left transition-colors last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300",
        notification.isRead
          ? "bg-background text-muted-foreground hover:bg-muted/50"
          : "border-l-2 border-l-sky-500 bg-sky-50/70 text-foreground hover:bg-sky-50",
      )}
      onClick={() => onMarkRead(notification)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onMarkRead(notification);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <span
        className={cn(
          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
          notification.isRead
            ? "bg-muted text-muted-foreground"
            : "bg-sky-100 text-sky-700",
        )}
      >
        {renderNotificationIcon(notification.type)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-3">
          <span
            className={cn(
              "truncate text-sm",
              notification.isRead ? "font-medium" : "font-semibold",
            )}
          >
            {notification.title}
          </span>
          {!notification.isRead ? (
            <span className="mt-1 size-2 shrink-0 rounded-full bg-sky-500" />
          ) : null}
        </span>
        {notification.message ? (
          <span className="mt-1 line-clamp-2 block text-xs leading-5 text-muted-foreground">
            {notification.message}
          </span>
        ) : null}
        <span className="mt-1 block text-[11px] text-muted-foreground">
          {formatNotificationDate(notification.createdAt)}
        </span>
        {notification.href ? (
          <button
            className="mt-2 inline-flex rounded-md px-2 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-200 hover:bg-sky-100"
            onClick={(event) => {
              event.stopPropagation();
              onView(notification);
            }}
            type="button"
          >
            Ver
          </button>
        ) : null}
      </span>
    </div>
  );
}
