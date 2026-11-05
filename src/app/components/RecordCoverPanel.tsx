/**
 * The record's cover in Moon Studio: shows it, and lets the cataloger upload a picture, take the
 * cover from Open Library / Google Books by the record's ISBN, or remove it. On a new record that is
 * not saved yet, the picture is kept here and uploaded right after the first save (`pendingCover`).
 */
import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, BookOpen, Trash2, Loader2 } from 'lucide-react';
import { uploadCover, coverFromIsbn, deleteCover } from '../utils/recordCovers';

interface Props {
  recordId?: string;
  coverUrl?: string;
  isbn?: string;
  language: 'en' | 'ar' | string;
  onChange: (coverUrl: string | undefined) => void;
  /** A picture chosen before the record's first save; the editor uploads it once the record is saved. */
  pendingCover?: File | null;
  onPendingCoverChange?: (file: File | null) => void;
}

export function RecordCoverPanel({ recordId, coverUrl, isbn, language, onChange, pendingCover, onPendingCoverChange }: Props) {
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!pendingCover) { setPendingPreview(null); return; }
    const url = URL.createObjectURL(pendingCover);
    setPendingPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingCover]);
  const ar = language === 'ar';
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<null | 'upload' | 'isbn' | 'remove'>(null);
  const [message, setMessage] = useState<string | null>(null);

  const run = async (kind: 'upload' | 'isbn' | 'remove', job: () => Promise<{ ok: boolean; coverUrl?: string; error?: string; status?: number }>) => {
    setBusy(kind);
    setMessage(null);
    const res = await job();
    setBusy(null);
    if (!res.ok) {
      setMessage(res.status === 401 ? (ar ? 'سجّل الدخول لتغيير الغلاف' : 'Sign in to change the cover') : (res.error || (ar ? 'تعذّر الحفظ' : 'Could not save')));
      return;
    }
    onChange(kind === 'remove' ? undefined : res.coverUrl);
  };

  const box: React.CSSProperties = {
    borderRadius: 16, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.25)',
  };
  const button = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white disabled:opacity-50 hover:bg-white/20 transition-colors';

  return (
    <div className="flex items-center gap-3 p-3" style={box} dir={ar ? 'rtl' : 'ltr'}>
      <div className="h-24 w-16 shrink-0 overflow-hidden rounded-md flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.12)' }}>
        {coverUrl || pendingPreview
          ? <img src={coverUrl || pendingPreview || ''} alt={ar ? 'الغلاف' : 'Cover'} className="h-full w-full object-cover" />
          : <BookOpen className="h-6 w-6 text-white/50" />}
      </div>
      <div className="min-w-0 space-y-2">
        <div className="text-sm font-bold text-white">{ar ? 'غلاف التسجيلة' : 'Cover'}</div>
        {!recordId ? (
          onPendingCoverChange ? (
            <div className="space-y-1.5">
              <div className="flex flex-wrap gap-1.5">
                <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onPendingCoverChange(f); }} />
                <button type="button" className={button} style={box} onClick={() => file.current?.click()}>
                  <ImagePlus className="h-3.5 w-3.5" />
                  {pendingCover ? (ar ? 'تغيير الصورة' : 'Change picture') : (ar ? 'اختيار صورة الغلاف' : 'Choose cover picture')}
                </button>
                {pendingCover && (
                  <button type="button" className={button} style={box} onClick={() => onPendingCoverChange(null)}>
                    <Trash2 className="h-3.5 w-3.5" />
                    {ar ? 'إزالة' : 'Remove'}
                  </button>
                )}
              </div>
              <p className="text-xs text-white/70">
                {pendingCover
                  ? (ar ? 'سيُرفع الغلاف عند حفظ التسجيلة.' : 'The cover is uploaded when you save the record.')
                  : (ar ? 'يمكنك إضافة الغلاف الآن؛ يُرفع عند أول حفظ.' : 'Add the cover now; it is uploaded on the first save.')}
              </p>
            </div>
          ) : (
            <p className="text-xs text-white/70">{ar ? 'احفظ التسجيلة أولاً، ثم أضف غلافها.' : 'Save the record first, then add its cover.'}</p>
          )
        ) : (
          <div className="flex flex-wrap gap-1.5">
            <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) run('upload', () => uploadCover(recordId, f)); }} />
            <button type="button" className={button} style={box} disabled={!!busy} onClick={() => file.current?.click()}>
              {busy === 'upload' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
              {ar ? 'رفع صورة' : 'Upload picture'}
            </button>
            <button type="button" className={button} style={box} disabled={!!busy || !isbn} title={isbn ? `ISBN ${isbn}` : (ar ? 'لا يوجد ردمك في التسجيلة' : 'The record has no ISBN')}
              onClick={() => isbn && run('isbn', () => coverFromIsbn(recordId, isbn))}>
              {busy === 'isbn' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookOpen className="h-3.5 w-3.5" />}
              {ar ? 'من ردمك (Open Library / Google)' : 'From ISBN (Open Library / Google)'}
            </button>
            {coverUrl && (
              <button type="button" className={button} style={box} disabled={!!busy} onClick={() => run('remove', () => deleteCover(recordId))}>
                {busy === 'remove' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                {ar ? 'إزالة' : 'Remove'}
              </button>
            )}
          </div>
        )}
        {message && <p className="text-xs text-red-200">{message}</p>}
      </div>
    </div>
  );
}
