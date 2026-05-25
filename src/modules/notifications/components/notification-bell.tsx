"use client";

import { Bell } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { NotificationDropdown } from "@/modules/notifications/components/notification-dropdown";
import type { UserNotification } from "@/modules/notifications/types";
import { cn } from "@/lib/utils";

type NotificationBellProps = {
  initialCount: number;
  notifications: UserNotification[];
};

export function NotificationBell({
  initialCount,
  notifications,
}: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(initialCount);
  const [isRinging, setIsRinging] = useState(false);
  const hasMountedRef = useRef(false);
  const previousInitialCountRef = useRef(initialCount);

  useEffect(() => {
    const previousCount = previousInitialCountRef.current;
    const nextCount = initialCount;
    const shouldRing = hasMountedRef.current && nextCount > previousCount;

    const syncTimeout = window.setTimeout(() => {
      setUnreadCount(nextCount);

      if (shouldRing) {
        setIsRinging(true);
        playNotificationSound();
      }
    }, 0);

    let ringTimeout: number | undefined;

    if (shouldRing) {
      ringTimeout = window.setTimeout(() => {
        setIsRinging(false);
      }, 900);
    }

    hasMountedRef.current = true;
    previousInitialCountRef.current = nextCount;

    return () => {
      window.clearTimeout(syncTimeout);
      if (ringTimeout) window.clearTimeout(ringTimeout);
    };
  }, [initialCount]);

  function handleAnyRead() {
    setUnreadCount((current) => Math.max(0, current - 1));
  }

  function handleAllRead() {
    setUnreadCount(0);
  }

  return (
    <div className="fixed right-6 top-5 z-40">
      <div className="relative">
        <button
          aria-expanded={isOpen}
          aria-label={
            unreadCount > 0
              ? `Notificaciones, ${unreadCount} no leidas`
              : "Notificaciones"
          }
          className={cn(
            "flex size-10 items-center justify-center rounded-full border bg-background text-foreground shadow-sm transition-colors hover:bg-muted",
            unreadCount > 0 ? "border-sky-200 ring-2 ring-sky-100" : null,
            isRinging ? "notification-bell-ringing" : null,
          )}
          onClick={() => setIsOpen((current) => !current)}
          type="button"
        >
          <Bell aria-hidden="true" size={20} />
        </button>
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-semibold leading-5 text-white shadow-sm">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
        {unreadCount > 0 ? (
          <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-sky-500 ring-2 ring-background notification-bell-dot" />
        ) : null}
      </div>

      {isOpen ? (
        <NotificationDropdown
          notifications={notifications}
          onAllRead={handleAllRead}
          onAnyRead={handleAnyRead}
        />
      ) : null}
    </div>
  );
}

function playNotificationSound() {
  // TODO: permitir activar/desactivar sonidos por usuario.
  try {
    const AudioContextClass =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;

    if (!AudioContextClass) return;

    const audioContext = new AudioContextClass();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = 740;
    gain.gain.value = 0.04;

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.12);
  } catch {
    // El navegador puede bloquear audio sin interaccion previa.
  }
}
