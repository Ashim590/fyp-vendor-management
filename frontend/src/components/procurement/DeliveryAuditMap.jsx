import React, { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getAllDeliveries, getMyDeliveries } from "@/redux/deliverySlice";
import { Button } from "../ui/button";
import {
  WorkspacePageLayout,
  WorkspacePageHeader,
} from "../layout/WorkspacePageLayout";
import {
  DELIVERY_STATUS,
  normalizeDeliveryStatus,
  statusLabel,
} from "@/utils/deliveryWorkflow";

const VERIFIED_MARKER_ICON = L.divIcon({
  className: "border-0 bg-transparent",
  html:
    '<div style="width:22px;height:22px;border-radius:50%;background:#16a34a;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)" aria-hidden="true"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  popupAnchor: [0, -8],
});

function formatDateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-NP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Leaflet needs the container laid out + invalidateSize before setView/fitBounds
 * or the map can stay at the initial zoom (wide Himalayan view). OSM default tiles
 * also show local scripts (e.g. Chinese) near borders — basemap uses Carto Voyager
 * for clearer Latin labels in this region.
 */
function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points?.length) return;

    let cancelled = false;
    const apply = () => {
      if (cancelled) return;
      map.invalidateSize({ animate: false });
      if (points.length === 1) {
        map.setView([points[0].lat, points[0].lng], 15, { animate: false });
        return;
      }
      const b = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
      map.fitBounds(b, { padding: [56, 56], maxZoom: 16, animate: false });
    };

    const t = window.setTimeout(apply, 120);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [map, points]);
  return null;
}

const DeliveryAuditMap = () => {
  const dispatch = useDispatch();
  const { deliveries, loading } = useSelector((store) => store.delivery);
  const { user } = useSelector((store) => store.auth);
  const isVendor = user?.role === "vendor";
  const [viewMode, setViewMode] = React.useState("map");
  const [daysFilter, setDaysFilter] = React.useState("15");

  useEffect(() => {
    if (isVendor) {
      dispatch(getMyDeliveries({ limit: 100 }));
    } else {
      dispatch(getAllDeliveries({ limit: 100 }));
    }
  }, [dispatch, isVendor]);

  const mapPoints = useMemo(() => {
    return deliveries
      .filter((d) => {
        const s = normalizeDeliveryStatus(d?.status);
        if (s !== DELIVERY_STATUS.VERIFIED) return false;
        return Array.isArray(d?.deliveryLocation?.coordinates);
      })
      .map((d) => {
        const [lng, lat] = d.deliveryLocation.coordinates;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return {
          id: d._id,
          lat,
          lng,
          deliveryNumber: d.deliveryNumber || "N/A",
          orderReference:
            d.orderRef || d.orderReference || d.purchaseOrderNumber || "N/A",
          vendorName: d.vendorName || "N/A",
          deliveredAt: d.deliveredAt || d.actualDate,
          status: d.status,
          proofUrl: d.deliveryProofImage || d.vendorProofImage || "",
        };
      })
      .filter(Boolean);
  }, [deliveries]);

  const filteredPoints = useMemo(() => {
    if (daysFilter === "all") return mapPoints;
    const days = Number(daysFilter);
    if (!Number.isFinite(days) || days <= 0) return mapPoints;
    const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
    return mapPoints.filter((point) => {
      if (!point.deliveredAt) return false;
      const ts = new Date(point.deliveredAt).getTime();
      return Number.isFinite(ts) && ts >= cutoffMs;
    });
  }, [mapPoints, daysFilter]);

  const initialCenter = filteredPoints.length
    ? [filteredPoints[0].lat, filteredPoints[0].lng]
    : [28.2096, 83.9856];
  const initialZoom =
    filteredPoints.length === 1 ? 15 : filteredPoints.length > 1 ? 8 : 8;

  return (
    <WorkspacePageLayout>
      <WorkspacePageHeader title="Delivery audit map" />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
            <button
              type="button"
              onClick={() => setViewMode("map")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                viewMode === "map"
                  ? "bg-[#0b1f4d] text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Map view
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                viewMode === "table"
                  ? "bg-[#0b1f4d] text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Table view
            </button>
          </div>
          <select
            value={daysFilter}
            onChange={(e) => setDaysFilter(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700"
            aria-label="Filter geo-verified deliveries by date range"
          >
            <option value="7">Last 7 days</option>
            <option value="15">Last 15 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="all">All time</option>
          </select>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <Link to="/deliveries">Back to deliveries</Link>
        </Button>
      </div>

      {viewMode === "map" ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="h-[520px] w-full">
            <MapContainer
              key={filteredPoints.length ? "markers" : "empty"}
              center={initialCenter}
              zoom={initialZoom}
              scrollWheelZoom
              className="h-full w-full"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                subdomains="abcd"
              />
              <FitBounds points={filteredPoints} />
              {filteredPoints.map((point) => (
                <Marker
                  key={point.id}
                  position={[point.lat, point.lng]}
                  icon={VERIFIED_MARKER_ICON}
                >
                  <Popup>
                    <div className="max-w-xs space-y-1 text-sm">
                      <p>
                        <strong>Delivery:</strong> {point.deliveryNumber}
                      </p>
                      <p>
                        <strong>Order ref:</strong> {point.orderReference}
                      </p>
                      <p>
                        <strong>Vendor:</strong> {point.vendorName}
                      </p>
                      <p>
                        <strong>Status:</strong> {statusLabel(point.status)}
                      </p>
                      <p>
                        <strong>Verified:</strong>{" "}
                        {formatDateTime(point.deliveredAt)}
                      </p>
                      <p>
                        <strong>Coords:</strong> {point.lat.toFixed(6)},{" "}
                        {point.lng.toFixed(6)}
                      </p>
                      {point.proofUrl ? (
                        <div className="pt-1">
                          <p className="mb-1 font-medium">Proof</p>
                          <img
                            src={point.proofUrl}
                            alt="Delivery proof"
                            className="max-h-40 w-full rounded border object-contain"
                          />
                        </div>
                      ) : null}
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </div>
      ) : filteredPoints.length > 0 ? (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-semibold">Delivery #</th>
                <th className="px-3 py-2 font-semibold">Order ref</th>
                <th className="px-3 py-2 font-semibold">Vendor</th>
                <th className="px-3 py-2 font-semibold">Verified at</th>
                <th className="px-3 py-2 font-semibold">Latitude</th>
                <th className="px-3 py-2 font-semibold">Longitude</th>
              </tr>
            </thead>
            <tbody>
              {filteredPoints.map((point) => (
                <tr key={`row-${point.id}`} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium text-slate-900">
                    {point.deliveryNumber}
                  </td>
                  <td className="px-3 py-2">{point.orderReference}</td>
                  <td className="px-3 py-2">{point.vendorName}</td>
                  <td className="px-3 py-2">{formatDateTime(point.deliveredAt)}</td>
                  <td className="px-3 py-2 tabular-nums">{point.lat.toFixed(6)}</td>
                  <td className="px-3 py-2 tabular-nums">{point.lng.toFixed(6)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {!loading && filteredPoints.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
          No geo-tagged delivery records found for this time range.
        </p>
      ) : null}
    </WorkspacePageLayout>
  );
};

export default DeliveryAuditMap;
