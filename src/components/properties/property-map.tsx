"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import { formatInr } from "@/lib/format";
import type { PropertyRow } from "@/types/db";

// Round price label used as the map pin (plain divIcon, no image files needed)
function pinIcon(label: string, selected: boolean, sold: boolean) {
  const background = selected ? "#ffffff" : sold ? "#8a8a93" : "#0b0b0f";
  const color = selected ? "#0b0b0f" : "#ffffff";
  const border = selected ? "2px solid #0b0b0f" : "2px solid #ffffff";

  return L.divIcon({
    className: "",
    iconSize: [0, 0],
    html: `<span style="position:absolute;transform:translate(-50%,-50%);background:${background};color:${color};border:${border};padding:4px 10px;border-radius:999px;font:600 12px/1.2 system-ui,sans-serif;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,.25);">${label}</span>`,
  });
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 14);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 14 });
  }, [map, points]);

  return null;
}

type PropertyMapProps = {
  properties: PropertyRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function PropertyMap({ properties, selectedId, onSelect }: PropertyMapProps) {
  const located = useMemo(
    () => properties.filter((p) => p.lat !== null && p.lng !== null),
    [properties]
  );

  const points = useMemo(
    () => located.map((p) => [p.lat as number, p.lng as number] as [number, number]),
    [located]
  );

  const icons = useMemo(() => {
    const map = new Map<string, L.DivIcon>();
    for (const p of located) {
      map.set(p.id, pinIcon(formatInr(p.price_inr), p.id === selectedId, p.status === "sold"));
    }
    return map;
  }, [located, selectedId]);

  return (
    // "isolate" keeps Leaflet's internal z-indexes from covering the header and drawers
    <div className="isolate overflow-hidden rounded-2xl border border-border">
      <MapContainer
        center={[28.55, 77.3]}
        zoom={9}
        scrollWheelZoom
        className="h-[560px] w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={points} />
        {located.map((p) => (
          <Marker
            key={p.id}
            position={[p.lat as number, p.lng as number]}
            icon={icons.get(p.id)}
            title={`${p.title}, ${formatInr(p.price_inr)}`}
            zIndexOffset={p.id === selectedId ? 1000 : 0}
            eventHandlers={{ click: () => onSelect(p.id) }}
          />
        ))}
      </MapContainer>
    </div>
  );
}