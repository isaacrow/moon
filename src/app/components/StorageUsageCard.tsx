/**
 * The Super Admin's "Backend storage" card: how much of the Supabase plan Moon uses, as a percentage, for
 * the database and for the files (covers, profile pictures). Read from the edge function's /admin/storage.
 */
import React, { useEffect, useState } from 'react';
import { Database, HardDrive, RefreshCw } from 'lucide-react';
import { moonFetch } from '../utils/moonApi';

interface StorageUsage {
  databaseBytes: number;
  databaseLimitBytes: number;
  storageBytes: number;
  storageLimitBytes: number;
  storageFiles: number;
  records: number;
}

const GLASS: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.58)',
  borderRadius: '28px',
  boxShadow: '0 20px 50px -10px rgba(15, 23, 42, 0.08), inset 0 1px 1px 0 rgba(255, 255, 255, 0.9)',
  backdropFilter: 'blur(24px) saturate(160%)',
  WebkitBackdropFilter: 'blur(24px) saturate(160%)',
  border: '1px solid rgba(255, 255, 255, 0.78)',
};

const size = (bytes: number) => {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

function Meter({ icon: Icon, label, used, limit, note }: { icon: any; label: string; used: number; limit: number; note: string }) {
  const pct = limit > 0 ? (100 * used) / limit : 0;
  const shown = pct < 1 && used > 0 ? pct.toFixed(1) : Math.round(pct).toString();
  const color = pct >= 90 ? '#e11d48' : pct >= 70 ? '#d97706' : '#0369a1';
  return (
    <div className="flex-1 min-w-[220px]">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: '#4a5568' }}>
          <Icon className="h-4 w-4" /> {label}
        </div>
        <div className="text-2xl font-black tracking-tight" style={{ color }}>{shown}%</div>
      </div>
      <div
        className="h-3 w-full overflow-hidden"
        style={{ borderRadius: 9999, background: 'rgba(15, 23, 42, 0.08)' }}
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div style={{ width: `${Math.min(100, Math.max(pct, used > 0 ? 1 : 0))}%`, height: '100%', borderRadius: 9999, background: color, transition: 'width .6s ease' }} />
      </div>
      <div className="mt-1.5 text-xs font-medium" style={{ color: '#64748b' }}>
        {size(used)} / {size(limit)} · {note}
      </div>
    </div>
  );
}

export function StorageUsageCard({ isAr }: { isAr: boolean }) {
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await moonFetch<StorageUsage & { error?: string }>('/admin/storage');
      if (res.ok) { setUsage(res.data); setError(null); }
      else setError(res.data?.error || `Error ${res.status}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="p-6" style={GLASS}>
      <div className="flex items-center justify-between mb-4">
        <div className="text-base font-bold" style={{ color: '#1a202c' }}>
          {isAr ? 'مساحة الخادم' : 'Backend storage'}
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="p-2 rounded-full hover:bg-white/60 transition-colors disabled:opacity-50"
          title={isAr ? 'تحديث' : 'Refresh'}
          aria-label={isAr ? 'تحديث' : 'Refresh'}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} style={{ color: '#475569' }} />
        </button>
      </div>
      {error && !usage && (
        <div className="text-sm" style={{ color: '#be123c' }}>{isAr ? 'تعذرت قراءة المساحة: ' : 'Could not read storage use: '}{error}</div>
      )}
      {!error && !usage && <div className="text-sm" style={{ color: '#64748b' }}>{isAr ? 'جارٍ القراءة…' : 'Reading…'}</div>}
      {usage && (
        <div className="flex flex-wrap gap-6">
          <Meter
            icon={Database}
            label={isAr ? 'قاعدة البيانات' : 'Database'}
            used={usage.databaseBytes}
            limit={usage.databaseLimitBytes}
            note={isAr ? `${usage.records} تسجيلة` : `${usage.records} records`}
          />
          <Meter
            icon={HardDrive}
            label={isAr ? 'الملفات (الأغلفة والصور)' : 'Files (covers, pictures)'}
            used={usage.storageBytes}
            limit={usage.storageLimitBytes}
            note={isAr ? `${usage.storageFiles} ملف` : `${usage.storageFiles} files`}
          />
        </div>
      )}
    </div>
  );
}
