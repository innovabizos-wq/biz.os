"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";

import { DRIVER_STATUS_LABELS } from "@/modules/logistics/constants";
import type { LiveDriver } from "@/modules/driver-tracking/types";

type LiveDriversMapClientProps = {
  drivers: LiveDriver[];
};

const COSTA_RICA_CENTER: [number, number] = [9.9281, -84.0907];
const MARKER_COLORS = {
  available: "#10b981",
  finished: "#64748b",
  incident: "#ef4444",
  lunch: "#f97316",
  offline: "#94a3b8",
  on_route: "#2563eb",
  paused: "#f59e0b",
};

function hasLocation(driver: LiveDriver) {
  return (
    typeof driver.latitude === "number" &&
    typeof driver.longitude === "number" &&
    Number.isFinite(driver.latitude) &&
    Number.isFinite(driver.longitude)
  );
}

function formatLastSeen(value: string | null) {
  if (!value) return "Sin actualizacion";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Sin actualizacion";
  }

  return new Intl.DateTimeFormat("es-CR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function buildMarkerIcon(driver: LiveDriver) {
  const color = MARKER_COLORS[driver.status];

  return L.divIcon({
    className: "driver-live-marker",
    html: `
      <div style="display:flex;height:36px;width:36px;align-items:center;justify-content:center;border-radius:9999px;background:white;box-shadow:0 10px 18px rgba(15,23,42,0.22);">
        <div style="height:24px;width:24px;border-radius:9999px;background:${color};border:3px solid white;"></div>
      </div>
    `,
    iconAnchor: [18, 18],
    iconSize: [36, 36],
    popupAnchor: [0, -18],
  });
}

export default function LiveDriversMapClient({
  drivers,
}: LiveDriversMapClientProps) {
  const driversWithLocation = drivers.filter(hasLocation);
  const center =
    driversWithLocation.length > 0
      ? ([
          driversWithLocation[0].latitude,
          driversWithLocation[0].longitude,
        ] as [number, number])
      : COSTA_RICA_CENTER;

  return (
    <section className="h-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-black text-slate-950">
            Mapa en tiempo real
          </h3>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200">
            {driversWithLocation.length > 0
              ? "Actualizado hace 30 seg"
              : "Esperando choferes conectados"}
          </span>
        </div>
        <span className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <span
            className={`size-2 rounded-full ${
              driversWithLocation.length > 0 ? "bg-emerald-500" : "bg-slate-300"
            }`}
          />
          OpenStreetMap
        </span>
      </div>

      <div className="relative mt-4 h-[300px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
        <MapContainer
          center={center}
          className="h-full w-full"
          scrollWheelZoom={false}
          zoom={driversWithLocation.length > 0 ? 13 : 11}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {driversWithLocation.map((driver) => (
            <Marker
              icon={buildMarkerIcon(driver)}
              key={driver.profileId}
              position={[driver.latitude as number, driver.longitude as number]}
            >
              <Popup>
                <div className="space-y-1 text-sm">
                  <p className="font-bold text-slate-900">{driver.name}</p>
                  <p>{DRIVER_STATUS_LABELS[driver.status]}</p>
                  <p>Ultima actualizacion: {formatLastSeen(driver.lastSeenAt)}</p>
                  {driver.accuracy ? <p>Precision: {driver.accuracy} m</p> : null}
                  {driver.currentDispatchId ? (
                    <p>Despacho actual: {driver.currentDispatchId}</p>
                  ) : null}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {driversWithLocation.length === 0 ? (
          <div className="pointer-events-none absolute bottom-4 left-4 z-[500] w-[min(25rem,calc(100%-2rem))] rounded-xl border border-slate-200 bg-white/95 p-4 text-left shadow-lg">
            <p className="text-sm font-black text-slate-950">
              Aun no hay choferes conectados compartiendo ubicacion.
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Cuando un usuario con rol Chofer inicie jornada desde la app o
              vista movil, aparecera aqui.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
