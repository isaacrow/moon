/**
 * Real books to start the catalogue with: Arabic and English, each with its ISBN, publisher, date and
 * extent as Open Library's edition record gives them (checked November 2026), and each with an Open
 * Library cover for that ISBN. The Super Admin adds them from the dashboard; they are saved through the
 * normal save route (so they are published when complete) and their covers are fetched by ISBN, or
 * drawn from the title when no cover is found.
 */
import type { BIBFRAMERecord } from '../types/bibframe';
import { mintUriSet } from '../../services/uriMintingService';
import { getRecordById, saveRecord } from './recordStorageBackend';
import { coverFromIsbn, uploadCoverImage } from './recordCovers';

export interface SampleBook {
  isbn: string;
  lang: 'ara' | 'eng';
  title: string;
  subtitle?: string;
  /** Authorized access point: "Surname, Forename, dates". */
  author: string;
  translator?: string;
  responsibility: string;
  place?: string;
  publisher: string;
  date: string;
  extent?: string;
  genre: string;
  subjects: string[];
  summary: string;
}

export const SAMPLE_BOOKS: SampleBook[] = [
  {
    isbn: '9789770915349', lang: 'ara', title: 'أولاد حارتنا', author: 'محفوظ، نجيب، 1911-2006',
    responsibility: 'نجيب محفوظ', place: 'القاهرة', publisher: 'دار الشروق', date: '2019', extent: '588 صفحة',
    genre: 'رواية', subjects: ['الرواية العربية -- مصر', 'الأدب العربي -- القرن العشرون'],
    summary: 'رواية رمزية تتتبع أجيالاً من سكان حارة قاهرية واحدة، وصراعهم مع الظلم والسلطة عبر الزمن.',
  },
  {
    isbn: '9789770914960', lang: 'ara', title: 'أصداء السيرة الذاتية', author: 'محفوظ، نجيب، 1911-2006',
    responsibility: 'نجيب محفوظ', place: 'القاهرة', publisher: 'دار الشروق', date: '2007', extent: '131 صفحة',
    genre: 'سيرة ذاتية', subjects: ['محفوظ، نجيب، 1911-2006', 'الأدباء المصريون -- سير'],
    summary: 'نصوص قصيرة تأملية يستعيد فيها الكاتب ذكريات من حياته وخواطره في الحياة والموت.',
  },
  {
    isbn: '9789770268100', lang: 'ara', title: 'دعاء الكروان', author: 'حسين، طه، 1889-1973',
    responsibility: 'طه حسين', place: 'القاهرة', publisher: 'دار المعارف', date: '2008', extent: '160 صفحة',
    genre: 'رواية', subjects: ['الرواية العربية -- مصر', 'الريف المصري -- قصص'],
    summary: 'رواية عن فتاة ريفية تسعى إلى الثأر لأختها ثم تتغير حياتها في بيت الرجل الذي أرادت الانتقام منه.',
  },
  {
    isbn: '9789776174191', lang: 'ara', title: 'في الشعر الجاهلي', author: 'حسين، طه، 1889-1973',
    responsibility: 'طه حسين', place: 'القاهرة', publisher: 'الدار المصرية اللبنانية', date: '2010', extent: '420 صفحة',
    genre: 'دراسة أدبية', subjects: ['الشعر العربي -- العصر الجاهلي -- تاريخ ونقد'],
    summary: 'دراسة نقدية تطبق منهج الشك على الشعر المنسوب إلى العصر الجاهلي، أثارت جدلاً واسعاً عند صدورها.',
  },
  {
    isbn: '9789770144084', lang: 'ara', title: 'الوعد الحق', author: 'حسين، طه، 1889-1973',
    responsibility: 'طه حسين', place: 'القاهرة', publisher: 'الهيئة المصرية العامة للكتاب', date: '1995', extent: '172 صفحة',
    genre: 'رواية تاريخية', subjects: ['الإسلام -- تاريخ -- قصص'],
    summary: 'رواية تاريخية عن المسلمين الأوائل وما لقوه من عنت في سبيل عقيدتهم.',
  },
  {
    isbn: '9789953214146', lang: 'ara', title: 'لا أريد لهذه القصيدة أن تنتهي', author: 'درويش، محمود، 1941-2008',
    responsibility: 'محمود درويش', publisher: 'مؤسسة محمود درويش ؛ الأهلية للنشر والتوزيع', date: '2014', extent: '152 صفحة',
    genre: 'شعر', subjects: ['الشعر العربي -- فلسطين'],
    summary: 'مجموعة شعرية صدرت بعد رحيل الشاعر، تضم قصائده الأخيرة.',
  },
  {
    isbn: '9789933583415', lang: 'ara', title: 'نظرية المعرفة عند ابن خلدون', author: 'الوردي، علي، 1913-1995',
    translator: 'محمود، أنيس عبد الخالق', responsibility: 'علي الوردي ؛ ترجمة أنيس عبد الخالق محمود',
    publisher: 'الوراق', date: '2018', extent: '440 صفحة',
    genre: 'دراسة', subjects: ['ابن خلدون، عبد الرحمن بن محمد، 1332-1406', 'نظرية المعرفة'],
    summary: 'دراسة في فكر ابن خلدون ومنهجه في المعرفة والاجتماع، مترجمة إلى العربية.',
  },
  {
    isbn: '9780141036144', lang: 'eng', title: 'Nineteen eighty-four', author: 'Orwell, George, 1903-1950',
    responsibility: 'George Orwell', place: 'London', publisher: 'Penguin Books', date: '2008', extent: 'vii, 325 pages',
    genre: 'Novel', subjects: ['Totalitarianism -- Fiction', 'Dystopias -- Fiction'],
    summary: 'A novel of life under a totalitarian state that watches its citizens and rewrites the past.',
  },
  {
    isbn: '9780060935467', lang: 'eng', title: 'To kill a mockingbird', author: 'Lee, Harper, 1926-2016',
    responsibility: 'Harper Lee', place: 'New York', publisher: 'Harper Perennial Modern Classics', date: '2016', extent: '336 pages',
    genre: 'Novel', subjects: ['Race relations -- Southern States -- Fiction', 'Lawyers -- Fiction'],
    summary: 'A girl in a small Alabama town watches her father defend a Black man accused of a crime.',
  },
  {
    isbn: '9780743273565', lang: 'eng', title: 'The great Gatsby', author: 'Fitzgerald, F. Scott (Francis Scott), 1896-1940',
    responsibility: 'F. Scott Fitzgerald', place: 'New York', publisher: 'Scribner', date: '2004', extent: '180 pages',
    genre: 'Novel', subjects: ['Rich people -- Fiction', 'Long Island (N.Y.) -- Fiction'],
    summary: 'A mysterious millionaire on Long Island pursues the woman he loved years before.',
  },
  {
    isbn: '9780141439518', lang: 'eng', title: 'Pride and prejudice', author: 'Austen, Jane, 1775-1817',
    responsibility: 'Jane Austen', place: 'London', publisher: 'Penguin Books', date: '2003', extent: 'xlii, 435 pages',
    genre: 'Novel', subjects: ['Courtship -- Fiction', 'England -- Social life and customs -- 19th century -- Fiction'],
    summary: 'Elizabeth Bennet and Mr Darcy overcome their first judgements of each other.',
  },
  {
    isbn: '9780394740676', lang: 'eng', title: 'Orientalism', author: 'Said, Edward W., 1935-2003',
    responsibility: 'Edward W. Said', place: 'New York', publisher: 'Vintage Books', date: '1979',
    genre: 'Study', subjects: ['Orientalism', 'East and West'],
    summary: 'A study of how Western scholarship and literature have represented the Middle East.',
  },
  {
    isbn: '9780674395657', lang: 'eng', title: 'A history of the Arab peoples', author: 'Hourani, Albert, 1915-1993',
    responsibility: 'Albert Hourani', place: 'Cambridge, Mass.', publisher: 'Belknap Press of Harvard University Press', date: '1991', extent: 'xx, 551 pages',
    genre: 'History', subjects: ['Arab countries -- History'],
    summary: 'A history of the Arabic-speaking world from the rise of Islam to the late twentieth century.',
  },
];

const lc = (path: string, label: string) => ({ '@id': `http://id.loc.gov/vocabulary/${path}`, 'rdfs:label': label });

/** The record id a sample book is stored under: the same every time, so adding them twice updates. */
export const sampleStorageId = (b: SampleBook) => `sample-${b.isbn}`;

/** A BIBFRAME record for one sample book, in the shape the editor saves. */
export function sampleRecord(b: SampleBook, cataloger: string): BIBFRAMERecord {
  const uris = mintUriSet(`s${b.isbn}`);
  const ar = b.lang === 'ara';
  const role = (en: string, arLabel: string, code: string) => ({
    '@id': `http://id.loc.gov/vocabulary/relators/${code}`, '@type': 'bf:Role', 'rdfs:label': `${en} (${arLabel})`,
  });
  const contribution: any[] = [{
    '@type': ['bf:Contribution', 'bf:PrimaryContribution'],
    'bf:agent': { '@type': 'bf:Person', 'rdfs:label': b.author },
    'bf:role': role('Author', 'مؤلف', 'aut'),
  }];
  if (b.translator) {
    contribution.push({
      '@type': 'bf:Contribution',
      'bf:agent': { '@type': 'bf:Person', 'rdfs:label': b.translator },
      'bf:role': role('Translator', 'مترجم', 'trl'),
    });
  }
  const title = { '@type': 'bf:Title', 'bf:mainTitle': b.title, ...(b.subtitle ? { 'bf:subtitle': b.subtitle } : {}) };
  const work = {
    '@id': uris.work,
    '@type': ['bf:Work', 'bf:Text'],
    'rdfs:label': b.title,
    'bf:title': title,
    'bf:content': lc('contentTypes/txt', ar ? 'نص' : 'text'),
    'bf:language': lc(`languages/${b.lang}`, ar ? 'العربية' : 'English'),
    'bf:contribution': contribution,
    'bf:genreForm': { '@type': 'bf:GenreForm', 'rdfs:label': b.genre },
    'bf:subject': b.subjects.map((s) => ({ '@type': 'bf:Topic', 'rdfs:label': s })),
    'bf:summary': { '@type': 'bf:Summary', 'rdfs:label': b.summary },
    'bf:hasInstance': { '@id': uris.instance },
  };
  const instance = {
    '@id': uris.instance,
    '@type': ['bf:Instance', 'bf:Print'],
    'rdfs:label': b.title,
    'bf:title': title,
    'bf:instanceOf': { '@id': uris.work },
    'bf:responsibilityStatement': b.responsibility,
    'bf:provisionActivity': {
      '@type': ['bf:ProvisionActivity', 'bf:Publication'],
      ...(b.place ? { 'bf:place': { '@type': 'bf:Place', 'rdfs:label': b.place } } : {}),
      'bf:agent': { '@type': 'bf:Agent', 'rdfs:label': b.publisher },
      'bf:date': b.date,
    },
    'bf:provisionActivityStatement': [b.place, b.publisher].filter(Boolean).join(' : ') + `, ${b.date}`,
    ...(b.extent ? { 'bf:extent': { '@type': 'bf:Extent', 'rdfs:label': b.extent } } : {}),
    'bf:identifiedBy': [{ '@type': 'bf:Isbn', 'rdf:value': b.isbn }],
    'bf:media': lc('mediaTypes/n', ar ? 'غير وسيط' : 'unmediated'),
    'bf:carrier': lc('carriers/nc', ar ? 'مجلد' : 'volume'),
    'bf:issuance': lc('issuance/mono', ar ? 'مفرد' : 'single unit'),
  };
  const adminMetadata = {
    '@id': uris.admin,
    '@type': 'bf:AdminMetadata',
    'bf:descriptionConventions': lc('descriptionConventions/rda', 'RDA'),
    'bf:descriptionLanguage': lc(`languages/${b.lang}`, ar ? 'العربية' : 'English'),
    'bf:note': { '@type': 'bf:Note', 'rdfs:label': 'Sample record; edition data from Open Library.' },
  };
  return {
    '@context': { bf: 'http://id.loc.gov/ontologies/bibframe/', rdfs: 'http://www.w3.org/2000/01/rdf-schema#', rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#' },
    work: work as any,
    instance: instance as any,
    adminMetadata,
    metadata: {
      storageId: sampleStorageId(b),
      catalogingLanguage: ar ? 'ar' : 'en',
      descriptionConventions: 'rda',
      catalogingInterface: 'Sample records',
      resourceType: 'Monograph',
      uriSet: uris,
      createdAt: new Date().toISOString(),
      catalogerId: cataloger,
    } as any,
  };
}

/** A plain cover drawn from the title and author, for a book with no cover online. */
export function drawCover(b: SampleBook): string | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 600;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const hue = [...b.isbn].reduce((h, d) => (h * 31 + d.charCodeAt(0)) % 360, 7);
  const g = ctx.createLinearGradient(0, 0, 0, 600);
  g.addColorStop(0, `hsl(${hue} 45% 32%)`);
  g.addColorStop(1, `hsl(${(hue + 30) % 360} 50% 18%)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 400, 600);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, 352, 552);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.direction = b.lang === 'ara' ? 'rtl' : 'ltr';
  const wrap = (text: string, y: number, size: number, maxLines: number) => {
    ctx.font = `bold ${size}px serif`;
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (ctx.measureText(next).width > 320 && line) { lines.push(line); line = w; } else line = next;
    }
    if (line) lines.push(line);
    lines.slice(0, maxLines).forEach((l, i) => ctx.fillText(l, 200, y + i * size * 1.3));
  };
  wrap(b.title, 220, 40, 4);
  ctx.globalAlpha = 0.85;
  wrap(b.responsibility, 470, 24, 2);
  return canvas.toDataURL('image/jpeg', 0.88);
}

export interface SampleImportResult {
  saved: number;
  skipped: number;
  covers: number;
  failed: string[];
}

/** Saves every sample book (an existing one is left as it is) and gives each a cover. */
export async function importSampleRecords(cataloger: string, onProgress?: (done: number, total: number) => void): Promise<SampleImportResult> {
  const result: SampleImportResult = { saved: 0, skipped: 0, covers: 0, failed: [] };
  let done = 0;
  for (const b of SAMPLE_BOOKS) {
    const id = sampleStorageId(b);
    try {
      const existing = await getRecordById(id).catch(() => null);
      let hasCover = !!(existing as any)?.coverUrl || !!(existing?.record?.metadata as any)?.coverUrl;
      if (existing) {
        result.skipped++;
      } else {
        await saveRecord(sampleRecord(b, cataloger), cataloger);
        result.saved++;
      }
      if (!hasCover) {
        const fromIsbn = await coverFromIsbn(id, b.isbn);
        if (fromIsbn.ok) hasCover = true;
        else {
          const drawn = drawCover(b);
          if (drawn && (await uploadCoverImage(id, drawn)).ok) hasCover = true;
        }
        if (hasCover) result.covers++;
      }
    } catch (e) {
      result.failed.push(`${b.title}: ${e instanceof Error ? e.message : String(e)}`);
    }
    onProgress?.(++done, SAMPLE_BOOKS.length);
  }
  return result;
}
