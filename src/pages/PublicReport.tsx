import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();

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
        <StatusTerminal messages={[t('publicReport.errorCode'), t('publicReport.reportNotFound'), t('publicReport.verifyScanId')]} className="max-w-md w-full" />
      </div>
    );
  }

  if (!scan) {
    return (
      <div className="min-h-screen bg-surface-lowest flex items-center justify-center p-6">
        <StatusTerminal messages={[t('publicReport.fetchingData'), t('publicReport.standby')]} className="max-w-md w-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-lowest p-6 md:p-12 print:p-0 print:bg-white flex flex-col">
      <div className="max-w-3xl mx-auto w-full flex-1">
        
        {/* Header */}
        <div className="border-b border-outline-variant/30 pb-6 mb-8 print:border-black">
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight uppercase">
            {t('publicReport.freshscanBrand')}<span className="text-neon print:text-black">{t('publicReport.publicReport')}</span>
          </h1>
          <p className="font-mono text-[0.65rem] tracking-widest text-on-surface-variant mt-2 uppercase">
            {t('publicReport.generatedPrefix')}{new Date(scan.created_at).toLocaleString()} {t('publicReport.separator')} {t('publicReport.idPrefix')}{scan.id}
          </p>
        </div>

        {/* Score Card */}
        <div className="bg-surface-low border border-outline-variant/30 p-8 mb-8 print:border-black print:bg-white text-center">
          <p className="font-mono text-[0.65rem] tracking-widest text-on-surface-variant mb-2">{t('publicReport.freshnessScore')}</p>
          <p className={`font-display text-7xl font-bold ${scan.freshness_score >= 85 ? 'text-secondary' : 'text-neon'} print:text-black mb-4`}>
            {scan.freshness_score}
          </p>
          <div className="inline-block border border-outline-variant/30 px-4 py-2 bg-surface-lowest">
            <p className="font-mono text-xs tracking-widest uppercase">
              {t('publicReport.gradeBadge')}{scan.grade} {t('publicReport.separator')} {scan.label}
            </p>
          </div>
        </div>

        {/* Data Markers */}
        <div className="mb-12">
          <p className="font-mono text-[0.65rem] tracking-widest text-on-surface-variant mb-4 uppercase">{t('publicReport.rawMarkers')}</p>
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
            {copied ? t('publicReport.copiedClipboard') : t('publicReport.copyShareLink')}
          </button>
          <button 
            onClick={handlePrint} 
            className="flex-1 py-3 bg-surface-high text-on-surface font-display font-bold text-sm tracking-wider uppercase transition-colors hover:text-neon border border-outline-variant/30 cursor-pointer"
          >
            {t('publicReport.printSavePdf')}
          </button>
        </div>
      </div>
    </div>
  );
}
