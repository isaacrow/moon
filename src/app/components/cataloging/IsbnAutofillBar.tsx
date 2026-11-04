/**
 * ISBN auto-fill for the Category Cards layout: type or paste an ISBN (Arabic-Indic digits work),
 * press Auto-Fill, and the editor fills the empty title, authors, publication, extent and language.
 */
import React, { useState } from 'react';
import { Loader2, ScanBarcode } from 'lucide-react';
import { lookupIsbnDetailed, ISBNData } from '../../../services/authoritySearch';

interface IsbnAutofillBarProps {
  language: string;
  isLight?: boolean;
  /** Called with the normalized ISBN (ISBN-13 when there is one) and what the sources know, or null. */
  onResult: (isbn: string, data: ISBNData | null) => void;
}

export function IsbnAutofillBar({ language, isLight = false, onResult }: IsbnAutofillBarProps) {
  const ar = language === 'ar';
  const [isbn, setIsbn] = useState('');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'error' | 'warn' | 'ok'; text: string } | null>(null);

  const lookup = async () => {
    if (!isbn.trim() || loading) return;
    setLoading(true);
    setNotice(null);
    try {
      const { data, isbn: info, unreachable } = await lookupIsbnDetailed(isbn);
      if (!info.valid) {
        setNotice({
          tone: 'error',
          text: info.problem === 'checksum'
            ? (ar ? 'رقم الردمك غير صحيح: رقم التحقق لا يطابق. راجع الأرقام.' : 'Not a valid ISBN: the check digit does not match. Please re-check the digits.')
            : (ar ? 'الردمك يجب أن يتكون من 10 أو 13 رقماً.' : 'An ISBN has 10 or 13 digits.'),
        });
        return;
      }
      // Stored the way LC does: digits only, ISBN-13 when there is one.
      const normalized = info.isbn13 || info.digits;
      onResult(normalized, data);
      setIsbn(normalized);
      if (data) {
        setNotice({ tone: 'ok', text: ar ? `وُجد في: ${(data.foundIn || []).join('، ')}` : `Found in ${(data.foundIn || []).join(' and ')}` });
      } else {
        setNotice({
          tone: 'warn',
          text: unreachable.length
            ? (ar ? `تمت إضافة الردمك. لم يتم العثور على الكتاب، وتعذر الوصول إلى: ${unreachable.join('، ')}.` : `ISBN added. The book was not found, and ${unreachable.join(' and ')} could not be reached.`)
            : (ar ? 'تمت إضافة الردمك، لكن الكتاب غير موجود في Open Library أو Google Books. أدخل البيانات يدوياً.' : 'ISBN added, but the book is not in Open Library or Google Books. Please enter the details by hand.'),
        });
      }
    } catch {
      setNotice({ tone: 'error', text: ar ? 'تعذر البحث عن الردمك.' : 'The ISBN lookup failed.' });
    } finally {
      setLoading(false);
    }
  };

  const text = isLight ? '#0f172a' : '#f8fafc';
  const dim = isLight ? 'rgba(15,23,42,0.6)' : '#cbd5e1';
  const noticeColor = notice?.tone === 'error' ? '#f87171' : notice?.tone === 'warn' ? '#fbbf24' : '#34d399';

  return (
    <div
      className="mb-4 p-3 rounded-2xl"
      style={{ background: isLight ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.06)', border: isLight ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.15)' }}
    >
      <label htmlFor="cc-isbn" className="flex items-center gap-2 text-xs font-bold mb-2" style={{ color: text }}>
        <ScanBarcode className="h-4 w-4 text-sky-400" />
        {ar ? 'ملء تلقائي من الردمك (ISBN)' : 'Auto-fill from ISBN'}
      </label>
      <div className="flex gap-2">
        <input
          id="cc-isbn"
          type="text"
          inputMode="numeric"
          dir="ltr"
          value={isbn}
          onChange={(e) => setIsbn(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); lookup(); } }}
          placeholder="978-…"
          className="flex-1 min-w-0 px-3 py-2 rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-sky-400/50"
          style={{ background: isLight ? '#fff' : 'rgba(255,255,255,0.08)', border: isLight ? '1px solid rgba(0,0,0,0.15)' : '1px solid rgba(255,255,255,0.2)', color: text }}
        />
        <button
          type="button"
          onClick={lookup}
          disabled={loading || !isbn.trim()}
          className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
        >
          {loading
            ? <><Loader2 className="h-4 w-4 animate-spin" /> {ar ? 'جارٍ البحث...' : 'Looking up...'}</>
            : (ar ? 'ملء تلقائي' : 'Auto-Fill')}
        </button>
      </div>
      <p className="mt-2 text-[11px]" style={{ color: notice ? noticeColor : dim }} role={notice ? 'status' : undefined}>
        {notice?.text || (ar
          ? 'يملأ العنوان والمؤلفين والنشر والوصف المادي واللغة إن كانت فارغة، ولا يغيّر ما أدخلته.'
          : 'Fills the title, authors, publication, extent and language when they are empty; never changes what you entered.')}
      </p>
    </div>
  );
}
