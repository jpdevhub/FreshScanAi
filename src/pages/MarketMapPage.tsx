import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import GlassCard from "../components/GlassCard";
import StatusTerminal from "../components/StatusTerminal";
import Skeleton from "../components/Skeleton";
import { useTranslation } from 'react-i18next';
import { api } from "../lib/api";
import type { Market } from "../lib/types";

const TILE_DARK =
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const TILE_LIGHT =
  "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

function getActiveTile() {
  return document.documentElement.classList.contains("light")
    ? TILE_LIGHT
    : TILE_DARK;
}

function getScoreColor(score: number) {
  return score >= 85
    ? "text-secondary"
    : score >= 70
      ? "text-neon"
      : "text-error";
}

function getScoreBg(score: number) {
  return score >= 85 ? "bg-secondary" : score >= 70 ? "bg-neon" : "bg-error";
}

const createCustomIcon = (score: number) => {
  const hex = score >= 85 ? "#b5d25e" : score >= 70 ? "#c3f400" : "#ffb4ab";
  return L.divIcon({
    className: "custom-leaflet-icon bg-transparent",
    html: `<div style="
      width:14px;height:14px;
      background-color:${hex};
      border:2px solid rgba(0,0,0,0.8);
      transform:rotate(45deg);
      box-shadow:0 0 15px ${hex}80;
    "></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -14],
  });
};

function RecenterMap({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export default function MarketMapPage() {
  const { t } = useTranslation();

      const [markers, setMarkers] = useState<Market[]>([]);
  const [selected, setSelected] = useState<Market | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState("");
  const [tileUrl, setTileUrl] = useState(getActiveTile);
  const [mapCenter, setMapCenter] = useState<[number, number]>([22.5726, 88.3639]);
  const [regionName, setRegionName] = useState("KOLKATA");

  // Watch for theme class changes on <html> without depending on custom events
  useEffect(() => {
    const observer = new MutationObserver(() => setTileUrl(getActiveTile()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    async function fetchLiveMarkets(lat: number, lng: number) {
      setLoading(true);
      try {
        const res = await api.getLiveMarkets(lat, lng);
        setMarkers(res.markets || []);
      } catch (err) {
        // Handle translatable error keys from the API, with a specific fallback for this page.
        if (err instanceof Error && err.message.startsWith('error.')) {
          setErrorKey(err.message);
        } else {
          setErrorKey('marketMap.failedLoadMarketData');
        }
        console.error("Live market fetch error:", err);
      } finally {
        setLoading(false);
      }
    }

    if ("geolocation" in navigator) {
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setMapCenter([latitude, longitude]);
          setRegionName("LIVE GPS");
          fetchLiveMarkets(latitude, longitude);
        },
        (err) => {
          console.warn("Geolocation denied or failed, falling back to mock data.", err);
          api.getMarkets()
            .then(res => setMarkers(res.markets || []))
            .catch(() => setErrorKey('marketMap.failedLoadMarkets'))
            .finally(() => setLoading(false));
        },
        { timeout: 10000, enableHighAccuracy: false }
      );
    } else {
      api.getMarkets()
        .then(res => setMarkers(res.markets || []))
        .catch(() => setErrorKey('marketMap.failedLoadMarkets'))
        .finally(() => setLoading(false));
    }
  }, []);

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col relative z-0">
      {/* Header */}
      <div className="px-6 md:px-16 py-6 bg-surface-low z-20 shadow-md">
        <StatusTerminal
          messages={[
            t('marketMap.trustMapTerminal'),
            `${t('marketMap.regionPrefix')}${regionName}`,
            loading ? t('marketMap.syncingDb') : errorKey ? t('marketMap.loadError') : `${t('marketMap.nodesPrefix')}${markers.length}`,
          ]}
          className="mb-3"
        />
        <div className="flex items-end justify-between gap-4">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-display">
            {t('marketMap.marketTrustTitle')} <span className="text-neon">{t('marketMap.mapTitle')}</span>
          </h1>
          <Link
            to="/leaderboard"
            className="text-[0.65rem] sm:text-xs font-mono tracking-widest text-on-surface hover:text-neon flex items-center border border-outline-variant/30 px-2 py-1 sm:px-3 sm:py-1.5 bg-surface-lowest transition-colors no-underline whitespace-nowrap"
          >
            {t('marketMap.leaderboardLink')}
          </Link>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative z-10 min-h-0 bg-surface-lowest">
        <MapContainer
          center={mapCenter}
          zoom={12}
          scrollWheelZoom={true}
          className="w-full h-full z-0"
        >
          <RecenterMap center={mapCenter} />
          <TileLayer url={tileUrl} attribution="&copy; CARTO" />
          {markers.map((m) => (
            <Marker
              key={m.id}
              position={[m.lat, m.lng]}
              icon={createCustomIcon(m.score)}
              eventHandlers={{ click: () => setSelected(m) }}
            >
              <Popup className="brutalist-popup" closeButton={false}>
                <div className="p-2 font-mono">
                  <div className="text-[0.65rem] font-bold text-[#e2e2e2] uppercase mb-1">
                    {m.name}
                  </div>
                  <div
                    className="text-[0.55rem] tracking-widest"
                    style={{
                      color: m.score >= 85 ? "#b5d25e" : m.score >= 70 ? "#c3f400" : "#ffb4ab",
                    }}
                  >
                    {t('marketMap.scorePrefix')}{m.score} | {t('marketMap.vendorsPrefix')}{m.vendors}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Bottom panel */}
      <div className="bg-surface-low px-6 md:px-16 py-6 z-20">
        {errorKey && (
          <p className="text-error font-mono text-xs tracking-widest text-center mb-4">
            {t(errorKey)}
          </p>
        )}

        {loading ? (
          /* SKELETON LOADER STATE */
          <GlassCard className="p-5" variant="tonal">
            <div className="flex items-start justify-between mb-3">
              <div className="space-y-2">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-2 w-16" />
              </div>
              <div className="text-right space-y-2 flex flex-col items-end">
                <Skeleton className="h-8 w-12" />
                <Skeleton className="h-2 w-20" />
              </div>
            </div>
            <div className="h-1.5 w-full bg-surface-highest">
              <Skeleton className="h-full w-full" />
            </div>
          </GlassCard>
        ) : selected ? (
          /* SELECTED NODE STATE */
          <GlassCard className="p-5 animate-in" variant="tonal">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-display text-lg font-bold">
                  {selected.name}
                </h3>
                <span className="font-mono text-[0.5625rem] tracking-widest text-on-surface-variant">
                  {selected.vendors} {t('marketMap.vendorsLabel')}
                </span>
              </div>
              <div className="text-right">
                <span
                  className={`font-display text-3xl font-bold ${getScoreColor(selected.score)}`}
                >
                  {selected.score}
                </span>
                <span className="block font-mono text-[0.5rem] tracking-widest text-on-surface-variant">{t('marketMap.avgFreshness')}</span>
              </div>
            </div>
            <div className="h-1.5 bg-surface-highest">
              <div
                className={`h-full ${getScoreBg(selected.score)} transition-all duration-500`}
                style={{ width: `${selected.score}%` }}
              />
            </div>
          </GlassCard>
        ) : (
          /* IDLE/EMPTY STATE */
          <div className="text-center py-4">
            <span className="font-mono text-[0.6875rem] tracking-widest text-on-surface-variant">
              {t('marketMap.selectMarketNode')}
            </span>
          </div>
        )}

        <div className="flex items-center justify-center gap-6 mt-4">
          {[
            { l: t('marketMap.highTrust'), c: "bg-secondary" },
            { l: t('marketMap.mediumTrust'), c: "bg-neon" },
            { l: t('marketMap.lowTrust'), c: "bg-error" },
          ].map((x) => (
            <div key={x.l} className="flex items-center gap-2">
              <div className={`w-6 h-3 ${x.c} rounded-sm`} />
              <div className="text-[0.7rem] tracking-widest font-mono">{x.l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
