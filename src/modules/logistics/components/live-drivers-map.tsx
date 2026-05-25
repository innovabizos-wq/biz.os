"use client";

import dynamic from "next/dynamic";

import type { LiveDriver } from "@/modules/driver-tracking/types";

const LiveDriversMapClient = dynamic(
  () => import("@/modules/logistics/components/live-drivers-map-client"),
  {
    loading: () => (
      <section className="h-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="h-full rounded-2xl border border-slate-200 bg-slate-100" />
      </section>
    ),
    ssr: false,
  },
);

type LiveDriversMapProps = {
  drivers: LiveDriver[];
};

export function LiveDriversMap({ drivers }: LiveDriversMapProps) {
  return <LiveDriversMapClient drivers={drivers} />;
}
