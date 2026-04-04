import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import GlassCard from '../components/GlassCard';
import StatusTerminal from '../components/StatusTerminal';
import { api } from '../lib/api';
import type { Market } from '../lib/types';

function getScoreColor(score: number) {
  return score >= 85 ? 'text-secondary' : score >= 70 ? 'text-neon' : 'text-error';
}

function getScoreBg(score: number) {
  return score >= 85 ? 'bg-secondary' : score >= 70 ? 'bg-neon' : 'bg-error';
}

const createCustomIcon = (score: number) => {
  const hex = score >= 85 ? '#b5d25e' : score >= 70 ? '#c3f400' : '#ffb4ab';
  return L.divIcon({
    className: 'custom-leaflet-icon bg-transparent',
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

export default function MarketMapPage() {
  const [markers, setMarkers] = useState<Market[]>([]);
  const [selected, setSelected] = useState<Market | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  const defaultPosition: [number, number] = [22.5726, 88.3639];

  useEffect(() => {
    async function fetchMarkets() {
      setLoading(true);
      try {
        const res = await api.getMarkets();
        setMarkers(res.markets);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load market data.');
        console.error('Market fetch error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchMarkets();
  }, []);

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col relative z-0">
      {/* Header */}
      <div className="px-6 md:px-16 py-6 bg-surface-low z-20 shadow-md">
        <StatusTerminal
          messages={[
            'TRUST_MAP',
            'REGION: KOLKATA',
            loading ? 'SYNCING_DB...' : error ? 'LOAD_ERROR' : `NODES: ${markers.length}`,
          ]}
          className="mb-3"
        />
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-[family-name:var(--font-display)]">
          Market Trust <span className="text-neon">Map</span>
        </h1>
      </div>

      {/* Map */}
      <div className="flex-1 relative z-10 min-h-0 bg-surface-lowest">
        <MapContainer
          center={defaultPosition}
          zoom={12}
          scrollWheelZoom={true}
          className="w-full h-full z-0"
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution="&copy; CARTO"
          />
          {markers.map(m => (
            <Marker
              key={m.id}
              position={[m.lat, m.lng]}
              icon={createCustomIcon(m.score)}
              eventHandlers={{ click: () => setSelected(m) }}
            >
              <Popup className="brutalist-popup" closeButton={false}>
                <div className="p-2 font-[family-name:var(--font-mono)]">
                  <div className="text-[0.65rem] font-bold text-[#e2e2e2] uppercase mb-1">{m.name}</div>
                  <div
                    className="text-[0.55rem] tracking-widest"
                    style={{ color: m.score >= 85 ? '#b5d25e' : m.score >= 70 ? '#c3f400' : '#ffb4ab' }}
                  >
                    SCORE: {m.score} | VENDORS: {m.vendors}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Bottom panel */}
      <div className="bg-surface-low px-6 md:px-16 py-6 z-20">
        {error && (
          <p className="text-error font-[family-name:var(--font-mono)] text-xs tracking-widest text-center mb-4">
            {error}
          </p>
        )}

        {selected ? (
          <GlassCard className="p-5 animate-in" variant="tonal">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-[family-name:var(--font-display)] text-lg font-bold">{selected.name}</h3>
                <span className="font-[family-name:var(--font-mono)] text-[0.5625rem] tracking-widest text-on-surface-variant">
                  {selected.vendors} VENDORS
                </span>
              </div>
              <div className="text-right">
                <span className={`font-[family-name:var(--font-display)] text-3xl font-bold ${getScoreColor(selected.score)}`}>
                  {selected.score}
                </span>
                <span className="block font-[family-name:var(--font-mono)] text-[0.5rem] tracking-widest text-on-surface-variant">
                  AVG_FRESHNESS
                </span>
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
          <div className="text-center py-4">
            <span className="font-[family-name:var(--font-mono)] text-[0.6875rem] tracking-widest text-on-surface-variant">
              {loading ? 'DOWNLOADING_NODES...' : 'SELECT_MARKET_NODE'}
            </span>
          </div>
        )}

        <div className="flex items-center justify-center gap-6 mt-4">
          {[
            { l: 'HIGH (85+)', c: 'bg-secondary' },
            { l: 'MED (70-84)', c: 'bg-neon' },
            { l: 'LOW (<70)', c: 'bg-error' },
          ].map(x => (
            <div key={x.l} className="flex items-center gap-2">
              <div className={`w-3 h-3 ${x.c}`} />
              <span className="font-[family-name:var(--font-mono)] text-[0.5rem] tracking-widest text-on-surface-variant">
                {x.l}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
