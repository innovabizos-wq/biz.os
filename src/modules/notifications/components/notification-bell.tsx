"use client";

import { BellRing } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";

import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import { NotificationDropdown } from "@/modules/notifications/components/notification-dropdown";
import type { UserNotification } from "@/modules/notifications/types";
import { cn } from "@/lib/utils";

type NotificationBellProps = {
  className?: string;
  initialCount: number;
  notifications: UserNotification[];
  recipientProfileId: string;
};

type NotificationPollResponse = {
  notifications: UserNotification[];
  serverTime: string;
  unreadCount: number;
};

const POLL_INTERVAL_MS = 5_000;
const SOUND_STORAGE_KEY = "bizos.notifications.soundEnabled";

export function NotificationBell({
  className,
  initialCount,
  notifications,
  recipientProfileId,
}: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState(notifications);
  const [unreadCount, setUnreadCount] = useState(initialCount);
  const [isRinging, setIsRinging] = useState(false);
  const [isDropdownBusy, setIsDropdownBusy] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hasLoadedSoundPreference, setHasLoadedSoundPreference] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const hasMountedRef = useRef(false);
  const hasSyncedServerPropsRef = useRef(false);
  const previousUnreadIdsRef = useRef(
    new Set(notifications.filter((notification) => !notification.isRead).map(
      (notification) => notification.id,
    )),
  );
  const isPollingRef = useRef(false);
  const isDropdownBusyRef = useRef(false);
  const scheduledFollowupTimersRef = useRef(new Map<string, number>());
  const firedFollowupTimersRef = useRef(new Set<string>());
  const soundEnabledRef = useRef(true);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const nextUnreadIds = new Set(
        notifications
          .filter((notification) => !notification.isRead)
          .map((notification) => notification.id),
      );
      const hasNewUnreadNotification =
        hasSyncedServerPropsRef.current &&
        [...nextUnreadIds].some((id) => !previousUnreadIdsRef.current.has(id));

      setItems(notifications);
      setUnreadCount(initialCount);

      if (hasNewUnreadNotification) {
        ring();
      }

      previousUnreadIdsRef.current = nextUnreadIds;
      hasSyncedServerPropsRef.current = true;
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [initialCount, notifications]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const storedPreference = window.localStorage.getItem(SOUND_STORAGE_KEY);
      const nextSoundEnabled = storedPreference !== "false";

      setSoundEnabled(nextSoundEnabled);
      soundEnabledRef.current = nextSoundEnabled;
      setHasLoadedSoundPreference(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;

    if (hasLoadedSoundPreference) {
      window.localStorage.setItem(SOUND_STORAGE_KEY, soundEnabled ? "true" : "false");
    }
  }, [hasLoadedSoundPreference, soundEnabled]);

  useEffect(() => {
    function handleFirstInteraction() {
      unlockNotificationAudio(audioContextRef);
    }

    window.addEventListener("pointerdown", handleFirstInteraction, {
      once: true,
      passive: true,
    });
    window.addEventListener("keydown", handleFirstInteraction, { once: true });

    return () => {
      window.removeEventListener("pointerdown", handleFirstInteraction);
      window.removeEventListener("keydown", handleFirstInteraction);
    };
  }, []);

  function ring() {
    setIsRinging(true);
    void playNotificationBuzz(audioContextRef.current, soundEnabledRef.current);
    shakeScreen();

    window.setTimeout(() => {
      setIsRinging(false);
    }, 900);
  }

  const syncFromPoll = useCallback((payload: NotificationPollResponse) => {
    const nextUnreadIds = new Set(
      payload.notifications
        .filter((notification) => !notification.isRead)
        .map((notification) => notification.id),
    );
    const hasNewUnreadNotification = [...nextUnreadIds].some(
      (id) => !previousUnreadIdsRef.current.has(id),
    );

    setItems(payload.notifications);
    setUnreadCount(payload.unreadCount);

    if (hasMountedRef.current && hasNewUnreadNotification) {
      ring();
    }

    hasMountedRef.current = true;
    previousUnreadIdsRef.current = nextUnreadIds;
  }, []);

  const pollNotifications = useCallback(async () => {
    if (isPollingRef.current || isDropdownBusyRef.current) return;
    if (document.visibilityState !== "visible") return;

    isPollingRef.current = true;

    try {
      const response = await fetch("/api/notifications/poll", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) return;

      const payload = (await response.json()) as NotificationPollResponse;
      syncFromPoll(payload);
    } catch {
      // Polling no debe interrumpir la interfaz.
    } finally {
      isPollingRef.current = false;
    }
  }, [syncFromPoll]);

  useEffect(() => {
    hasMountedRef.current = true;
    const initialPollTimeout = window.setTimeout(() => {
      void pollNotifications();
    }, 800);
    const intervalId = window.setInterval(pollNotifications, POLL_INTERVAL_MS);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void pollNotifications();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearTimeout(initialPollTimeout);
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [pollNotifications]);

  useEffect(() => {
    const timers = scheduledFollowupTimersRef.current;
    const activeKeys = new Set<string>();
    const now = Date.now();

    for (const notification of items) {
      const scheduledAt = getFollowupScheduledAt(notification);

      if (!scheduledAt || notification.isRead) continue;

      const dueAt = scheduledAt.getTime();
      const key = `${notification.entityId ?? notification.id}:${scheduledAt.toISOString()}`;

      if (dueAt <= now || dueAt - now > 24 * 60 * 60_000) continue;
      if (firedFollowupTimersRef.current.has(key)) continue;

      activeKeys.add(key);

      if (!timers.has(key)) {
        const timeoutId = window.setTimeout(() => {
          timers.delete(key);
          firedFollowupTimersRef.current.add(key);
          void pollNotifications();
          ring();
        }, dueAt - now);

        timers.set(key, timeoutId);
      }
    }

    for (const [key, timeoutId] of timers) {
      if (!activeKeys.has(key)) {
        window.clearTimeout(timeoutId);
        timers.delete(key);
      }
    }

    return () => {
      for (const timeoutId of timers.values()) {
        window.clearTimeout(timeoutId);
      }
      timers.clear();
    };
  }, [items, pollNotifications]);

  useEffect(() => {
    let isSubscribed = true;
    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel(`user-notifications:${recipientProfileId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          filter: `recipient_profile_id=eq.${recipientProfileId}`,
          schema: "public",
          table: "user_notifications",
        },
        () => {
          if (isSubscribed) {
            void pollNotifications();
          }
        },
      )
      .subscribe();

    return () => {
      isSubscribed = false;
      void supabase.removeChannel(channel);
    };
  }, [pollNotifications, recipientProfileId]);

  function handleAnyRead(notificationId: string) {
    setUnreadCount((current) => Math.max(0, current - 1));
    setItems((current) =>
      current.map((notification) =>
        notification.id !== notificationId || notification.isRead
          ? notification
          : { ...notification, isRead: true, readAt: new Date().toISOString() },
      ),
    );
    previousUnreadIdsRef.current.delete(notificationId);
  }

  function handleAllRead() {
    setUnreadCount(0);
    previousUnreadIdsRef.current.clear();
    setItems((current) =>
      current.map((notification) => ({
        ...notification,
        isRead: true,
        readAt: notification.readAt ?? new Date().toISOString(),
      })),
    );
  }

  function handleDropdownBusyChange(nextValue: boolean) {
    setIsDropdownBusy(nextValue);
    isDropdownBusyRef.current = nextValue;
  }

  function handleToggleOpen() {
    unlockNotificationAudio(audioContextRef);
    setIsOpen((current) => !current);
  }

  return (
    <div className={cn("notification-bell-root relative z-40", className)}>
      <div className="relative">
        <button
          aria-expanded={isOpen}
          aria-label={
            unreadCount > 0
              ? `Notificaciones, ${unreadCount} no leidas`
              : "Notificaciones"
          }
          className={cn(
            "notification-bell-button flex size-10 items-center justify-center rounded-full border bg-background text-foreground shadow-sm transition-colors hover:bg-muted",
            unreadCount > 0 ? "border-sky-200 ring-2 ring-sky-100" : null,
            isRinging ? "notification-bell-ringing" : null,
          )}
          onClick={handleToggleOpen}
          type="button"
        >
          <BellRing aria-hidden="true" size={26} strokeWidth={2.15} />
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
          isBusy={isDropdownBusy}
          notifications={items}
          onAllRead={handleAllRead}
          onAnyRead={handleAnyRead}
          onBusyChange={handleDropdownBusyChange}
          onSoundPreferenceChange={setSoundEnabled}
          soundEnabled={soundEnabled}
        />
      ) : null}
    </div>
  );
}

function unlockNotificationAudio(audioContextRef: MutableRefObject<AudioContext | null>) {
  try {
    const AudioContextClass =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;

    if (!AudioContextClass) return;

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextClass();
    }

    if (audioContextRef.current.state === "suspended") {
      void audioContextRef.current.resume();
    }
  } catch {
    // El navegador puede bloquear audio sin interaccion previa.
  }
}

function getFollowupScheduledAt(notification: UserNotification) {
  if (notification.entityType !== "crm_followup") return null;

  const scheduledAt = notification.metadata.scheduledAt;

  if (typeof scheduledAt !== "string") return null;

  const date = new Date(scheduledAt);

  return Number.isNaN(date.getTime()) ? null : date;
}

function shakeScreen() {
  document.body.classList.remove("notification-screen-shake");
  void document.body.offsetWidth;
  document.body.classList.add("notification-screen-shake");

  window.setTimeout(() => {
    document.body.classList.remove("notification-screen-shake");
  }, 760);
}

async function playNotificationBuzz(
  existingAudioContext: AudioContext | null,
  soundEnabled: boolean,
) {
  if (!soundEnabled) return;

  try {
    const AudioContextClass =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;

    if (!AudioContextClass) return;

    const audioContext = existingAudioContext ?? new AudioContextClass();

    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    scheduleNotificationBuzz(audioContext);

    if ("vibrate" in navigator) {
      navigator.vibrate([100, 45, 100, 45, 80]);
    }
  } catch {
    // El navegador puede bloquear audio sin interaccion previa.
  }
}

function scheduleNotificationBuzz(audioContext: AudioContext) {
  const startAt = audioContext.currentTime + 0.01;
  const pulses = [0, 0.14, 0.28];

  for (const offset of pulses) {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(390, startAt + offset);
    oscillator.frequency.exponentialRampToValueAtTime(680, startAt + offset + 0.075);
    gain.gain.setValueAtTime(0.0001, startAt + offset);
    gain.gain.exponentialRampToValueAtTime(0.085, startAt + offset + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + offset + 0.115);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(startAt + offset);
    oscillator.stop(startAt + offset + 0.13);
  }
}
