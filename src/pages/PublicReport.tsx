import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import StatusTerminal from '../components/StatusTerminal';

interface ScanData {
  id: string;
  created_at: string;
  freshness_score: number;
  grade: string;
  label: string;
  markers: Record<string, unknown>;
}

export default function PublicReport() {
  const { id } = useParams();
  const [scan, setScan] = useState<ScanData | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`/api/v1/public/report/${id}`)
      .then(r => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then((data) => setScan(data.scan))
      .catch(() => setError(true));
  }, [id]);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => window.print();

  if (error) {
    return (
      <div className="min-h-screen bg-surface-lowest flex items-center justify-center p-6">
        <StatusTerminal messages={['ERROR: 404', 'REPORT_NOT_FOUND', 'VERIFY_SCAN_ID']} className="max-w-md w-full" />
      </div>
    );
  }

  if (!scan) {
    return (
      <div className="min-h-screen bg-surface-lowest flex items-center justify-center p-6">
        <StatusTerminal messages={['FETCHING_DATA', 'STANDBY...']} className="max-w-md w-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-lowest p-6 md:p-12 print:p-0 print:bg-white flex flex-col">
      <div className="max-w-3xl mx-auto w-full flex-1">
        
        {/* Header */}
        <div className="border-b border-outline-variant/30 pb-6 mb-8 print:border-black">
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight uppercase">
            FreshScan <span className="text-neon print:text-black">Public Report</span>
          </h1>
          <p className="font-mono text-[0.65rem] tracking-widest text-on-surface-variant mt-2 uppercase">
            GENERATED: {new Date(scan.created_at).toLocaleString()} | ID: {scan.id}
          </p>
        </div>

        {/* Score Card */}
        <div className="bg-surface-low border border-outline-variant/30 p-8 mb-8 print:border-black print:bg-white text-center">
          <p className="font-mono text-[0.65rem] tracking-widest text-on-surface-variant mb-2">FRESHNESS_SCORE</p>
          <p className={`font-display text-7xl font-bold ${scan.freshness_score >= 85 ? 'text-secondary' : 'text-neon'} print:text-black mb-4`}>
            {scan.freshness_score}
          </p>
          <div className="inline-block border border-outline-variant/30 px-4 py-2 bg-surface-lowest">
            <p className="font-mono text-xs tracking-widest uppercase">
              GRADE {scan.grade} — {scan.label}
            </p>
          </div>
        </div>

        {/* Data Markers */}
        <div className="mb-12">
          <p className="font-mono text-[0.65rem] tracking-widest text-on-surface-variant mb-4 uppercase">RAW_MARKERS</p>
          <pre className="font-mono text-xs bg-surface-low border border-outline-variant/30 p-4 text-on-surface print:bg-white print:border-black whitespace-pre-wrap">
            {JSON.stringify(scan.markers, null, 2)}
          </pre>
        </div>

        {/* Controls */}
        <div className="flex gap-4 print:hidden">
          <button
            onClick={handleShare}
            className="flex-1 py-3 bg-secondary text-on-primary font-display font-bold text-sm tracking-wider uppercase transition-colors hover:brightness-110 border-none cursor-pointer"
          >
            {copied ? 'COPIED TO CLIPBOARD' : 'COPY SHARE LINK'}
          </button>
          <button 
            onClick={handlePrint} 
            className="flex-1 py-3 bg-surface-high text-on-surface font-display font-bold text-sm tracking-wider uppercase transition-colors hover:text-neon border border-outline-variant/30 cursor-pointer"
          >
            PRINT / SAVE PDF
          </button>
        </div>
      </div>
    </div>
  );
}