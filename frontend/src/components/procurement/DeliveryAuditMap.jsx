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

  const initialCenter = mapPoints.length
    ? [mapPoints[0].lat, mapPoints[0].lng]
    : [28.2096, 83.9856];
  const initialZoom = mapPoints.length === 1 ? 15 : mapPoints.length > 1 ? 8 : 8;

  return (
    <WorkspacePageLayout>
      <WorkspacePageHeader title="Delivery audit map" />
      <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-sm text-slate-700">
          Showing{" "}
          <span className="font-semibold">{mapPoints.length}</span> geo-verified
          deliveries (GPS audit trail).
        </p>
        <Button asChild variant="outline" size="sm">
          <Link to="/deliveries">Back to deliveries</Link>
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <div className="h-[520px] w-full">
          <MapContainer
            key={mapPoints.length ? "markers" : "empty"}
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
            <FitBounds points={mapPoints} />
            {mapPoints.map((point) => (
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

      {!loading && mapPoints.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
          No geo-tagged delivery records yet.
        </p>
      ) : null}
    </WorkspacePageLayout>
  );
};

export default DeliveryAuditMap;
