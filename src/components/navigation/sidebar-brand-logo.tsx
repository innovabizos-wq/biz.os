"use client";

import { useMemo, useSyncExternalStore } from "react";

export const SIDEBAR_LOGO_STORAGE_KEY = "biz-os-sidebar-logo";
export const SIDEBAR_LOGO_CHANGE_EVENT = "bizos:sidebar-logo-changed";
const DEFAULT_LOGO_SNAPSHOT = "";

type SidebarLogoState = {
  name: string;
  src: string | null;
  subtitle: string;
};

const fallbackState: SidebarLogoState = {
  name: "biz.os",
  src: null,
  subtitle: "Nucleo empresarial",
};

export function parseSidebarLogoSnapshot(snapshot: string): SidebarLogoState {
  if (!snapshot) {
    return fallbackState;
  }

  try {
    const parsed = JSON.parse(snapshot) as Partial<SidebarLogoState>;

    return {
      name: typeof parsed.name === "string" && parsed.name.trim() ? parsed.name : "biz.os",
      src: typeof parsed.src === "string" && parsed.src.startsWith("data:image/")
        ? parsed.src
        : null,
      subtitle:
        typeof parsed.subtitle === "string" && parsed.subtitle.trim()
          ? parsed.subtitle
          : "Nucleo empresarial",
    };
  } catch {
    return fallbackState;
  }
}

export function getSidebarLogoSnapshot() {
  if (typeof window === "undefined") {
    return DEFAULT_LOGO_SNAPSHOT;
  }

  return window.localStorage.getItem(SIDEBAR_LOGO_STORAGE_KEY) ?? DEFAULT_LOGO_SNAPSHOT;
}

export function getServerSidebarLogoSnapshot() {
  return DEFAULT_LOGO_SNAPSHOT;
}

export function subscribeToSidebarLogoChanges(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === SIDEBAR_LOGO_STORAGE_KEY) {
      onStoreChange();
    }
  };

  const handleCustom = () => onStoreChange();

  window.addEventListener(SIDEBAR_LOGO_CHANGE_EVENT, handleCustom);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(SIDEBAR_LOGO_CHANGE_EVENT, handleCustom);
    window.removeEventListener("storage", handleStorage);
  };
}

export function saveSidebarLogo(state: SidebarLogoState) {
  window.localStorage.setItem(SIDEBAR_LOGO_STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new Event(SIDEBAR_LOGO_CHANGE_EVENT));
}

export function resetSidebarLogo() {
  window.localStorage.removeItem(SIDEBAR_LOGO_STORAGE_KEY);
  window.dispatchEvent(new Event(SIDEBAR_LOGO_CHANGE_EVENT));
}

export function SidebarBrandLogo() {
  const snapshot = useSyncExternalStore(
    subscribeToSidebarLogoChanges,
    getSidebarLogoSnapshot,
    getServerSidebarLogoSnapshot,
  );
  const logo = useMemo(() => parseSidebarLogoSnapshot(snapshot), [snapshot]);

  return (
    <div className="app-sidebar-brand" data-has-logo={Boolean(logo.src)}>
      <div className="app-sidebar-logo-frame">
        {logo.src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt={logo.name} className="app-sidebar-logo-image" src={logo.src} />
        ) : (
          <div className="app-sidebar-logo-fallback">{logo.name}</div>
        )}
      </div>
      <p className="app-sidebar-brand-caption">{logo.subtitle}</p>
    </div>
  );
}
