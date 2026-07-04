"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const DASHBOARD_PATHS = [
  "/dashboard",
];

function getDashboardIndex(pathname: string | null) {
  const index = DASHBOARD_PATHS.findIndex((path) => path === pathname);

  return index >= 0 ? index : 0;
}

export function DashboardBoardNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const activeIndexRef = useRef(getDashboardIndex(pathname));
  const lastNavigationRef = useRef(0);

  useEffect(() => {
    activeIndexRef.current = getDashboardIndex(pathname);
  }, [pathname]);

  useEffect(() => {
    function navigate(direction: 1 | -1) {
      const now = Date.now();

      if (now - lastNavigationRef.current < 520) {
        return;
      }

      const currentIndex = activeIndexRef.current;
      const nextIndex = Math.min(
        DASHBOARD_PATHS.length - 1,
        Math.max(0, currentIndex + direction),
      );

      if (nextIndex === currentIndex) {
        return;
      }

      lastNavigationRef.current = now;
      activeIndexRef.current = nextIndex;
      router.push(DASHBOARD_PATHS[nextIndex]);
    }

    function handleWheel(event: WheelEvent) {
      const dominantDelta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? event.deltaX
          : event.deltaY;

      if (Math.abs(dominantDelta) < 12) {
        return;
      }

      event.preventDefault();
      navigate(dominantDelta > 0 ? 1 : -1);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement ||
        (event.target instanceof HTMLElement && event.target.isContentEditable)
      ) {
        return;
      }

      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        navigate(1);
      }

      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        navigate(-1);
      }
    }

    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [router]);

  return null;
}
