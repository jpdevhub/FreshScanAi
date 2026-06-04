import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

export default function PublicReport() {
  const { id } = useParams();
  interface ScanData {
  id: string;
  // add other fields your scan object has
  [key: string]: unknown;
}
const [scan, setScan] = useState<ScanData | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/public/report/${id}`)
      .then(r => r.json())
      .then(setScan);
  }, [id]);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => window.print();

  if (!scan) return <div>Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto p-6 print:p-0">
      <h1 className="text-2xl font-bold">FreshScan AI — Freshness Report</h1>
      <p className="text-gray-500 text-sm mb-4">{new Date(scan.created_at).toLocaleString()}</p>

      <div className="bg-green-50 border border-green-300 rounded-xl p-6 mb-6">
        <p className="text-5xl font-bold text-green-600 text-center">{scan.freshness_score}</p>
        <p className="text-center text-green-700 font-semibold mt-1">{scan.grade} — {scan.label}</p>
      </div>

      {/* Marker breakdown, image, etc. from scan data */}
      <pre className="text-sm bg-gray-100 rounded p-4">{JSON.stringify(scan.markers, null, 2)}</pre>

      <div className="flex gap-3 mt-6 print:hidden">
        <button onClick={handleShare} className="px-4 py-2 bg-blue-600 text-white rounded-lg">
          {copied ? '✓ Copied!' : '🔗 Copy Share Link'}
        </button>
        <button onClick={handlePrint} className="px-4 py-2 border rounded-lg">
          🖨 Print / Save PDF
        </button>
      </div>
    </div>
  );
}