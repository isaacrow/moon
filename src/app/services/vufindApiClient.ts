/**
 * VuFind® API Client & Solr Indexer
 * Connects Moon to VuFind Library Discovery Portal (https://vufind.org/)
 * Supports REST API search, Solr biblio indexing, and two-way BIBFRAME conversion.
 * Pre-configured for local VuFind deployment at D:\vufind
 */

export interface VuFindConfig {
  baseUrl: string;
  solrUrl?: string;
  apiKey?: string;
  name?: string;
}

export interface VuFindSearchOptions {
  page?: number;
  limit?: number;
  type?: 'AllFields' | 'Title' | 'Author' | 'Subject' | 'CallNumber';
  sort?: 'relevance' | 'year' | 'title' | 'author';
  filter?: string[];
}

export interface VuFindRecord {
  id: string;
  title: string;
  titleFull?: string;
  authors?: { primary?: Record<string, string>; secondary?: Record<string, string> } | string[];
  publicationDates?: string[];
  publishers?: string[];
  places?: string[];
  formats?: string[];
  languages?: string[];
  isbns?: string[];
  issns?: string[];
  subjects?: string[][];
  callnumber?: string;
  urls?: Array<{ url: string; desc?: string }>;
  source?: string;
  raw?: any;
}

export interface VuFindSolrDoc {
  id: string;
  title: string;
  title_full?: string;
  title_sort?: string;
  author?: string;
  author_additional?: string[];
  publishDate?: string[];
  publisher?: string[];
  publishPlace?: string[];
  isbn?: string[];
  issn?: string[];
  format?: string[];
  language?: string[];
  topic?: string[];
  genre?: string[];
  record_format?: string;
  fulltext?: string;
}

export const VUFIND_PRESETS = {
  local: {
    name: 'Local VuFind Stack (D:\\vufind - Port 8085)',
    baseUrl: typeof window !== 'undefined' ? '/vufind' : 'http://localhost:8080',
    portalUrl: 'http://localhost:8085',
    solrUrl: typeof window !== 'undefined' ? '/solr/biblio' : 'http://localhost:8983/solr/biblio',
    description: 'Local VuFind discovery portal with Solr search index & FOLIO driver (D:\\folio)',
  },
  demo: {
    name: 'VuFind Community Demo',
    baseUrl: 'https://vufind.org/demo',
    solrUrl: 'https://vufind.org/demo/solr/biblio',
    description: 'Official VuFind Project public demo portal',
  },
};

export const DEFAULT_VUFIND_CONFIG: VuFindConfig = {
  baseUrl: typeof localStorage !== 'undefined' ? (localStorage.getItem('vufind_base_url') || VUFIND_PRESETS.local.baseUrl) : VUFIND_PRESETS.local.baseUrl,
  solrUrl: typeof localStorage !== 'undefined' ? (localStorage.getItem('vufind_solr_url') || VUFIND_PRESETS.local.solrUrl) : VUFIND_PRESETS.local.solrUrl,
};

export class VuFindApiClient {
  private config: VuFindConfig;

  constructor(config: Partial<VuFindConfig> = {}) {
    this.config = {
      ...DEFAULT_VUFIND_CONFIG,
      ...config,
    };
  }

  public getConfig(): VuFindConfig {
    return { ...this.config };
  }

  /**
   * Check connection to VuFind Web server / REST API
   */
  async checkHealth(): Promise<{ ok: boolean; message?: string; solrOk?: boolean }> {
    let ok = false;
    let message = '';
    let solrOk = false;

    // Probe VuFind base URL
    try {
      const res = await fetch(`${this.config.baseUrl}/api/v1/search?lookfor=test&limit=1`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (res.ok || res.status === 200 || res.status === 403) {
        ok = true;
        message = 'VuFind REST API responded';
      }
    } catch (e: any) {
      // Fallback probe base home page
      try {
        const homeRes = await fetch(this.config.baseUrl, { method: 'HEAD', mode: 'no-cors' });
        ok = true;
        message = 'VuFind Web server active';
      } catch (err: any) {
        message = e.message || 'Cannot reach VuFind portal';
      }
    }

    // Probe Solr if configured
    if (this.config.solrUrl) {
      try {
        const solrRes = await fetch(`${this.config.solrUrl}/admin/ping?wt=json`, {
          method: 'GET',
        });
        if (solrRes.ok) {
          solrOk = true;
        }
      } catch {
        solrOk = false;
      }
    }

    return { ok, message, solrOk };
  }

  /**
   * Search records in VuFind Discovery
   */
  async search(
    query: string,
    options: VuFindSearchOptions = {}
  ): Promise<{ records: VuFindRecord[]; resultCount: number }> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const type = options.type || 'AllFields';
    const sort = options.sort || 'relevance';

    // 1. Try VuFind REST API (/api/v1/search)
    try {
      const params = new URLSearchParams({
        lookfor: query,
        type,
        page: String(page),
        limit: String(limit),
        sort,
      });

      if (options.filter && options.filter.length > 0) {
        options.filter.forEach(f => params.append('filter[]', f));
      }

      const res = await fetch(`${this.config.baseUrl}/api/v1/search?${params.toString()}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (res.ok) {
        const json = await res.json();
        const records: VuFindRecord[] = (json.records || []).map((r: any) => this.normalizeRecord(r));
        return {
          records,
          resultCount: json.resultCount || records.length,
        };
      }
    } catch {
      // Try fallback to Solr direct select
    }

    // 2. Fallback to Solr biblio core select (/solr/biblio/select)
    if (this.config.solrUrl) {
      try {
        const start = (page - 1) * limit;
        const solrParams = new URLSearchParams({
          q: query ? `${type === 'Title' ? 'title:' : type === 'Author' ? 'author:' : ''}${query}` : '*:*',
          start: String(start),
          rows: String(limit),
          wt: 'json',
        });

        const solrRes = await fetch(`${this.config.solrUrl}/select?${solrParams.toString()}`);
        if (solrRes.ok) {
          const solrData = await solrRes.json();
          const docs = solrData.response?.docs || [];
          const records: VuFindRecord[] = docs.map((d: any) => this.normalizeSolrDoc(d));
          return {
            records,
            resultCount: solrData.response?.numFound || records.length,
          };
        }
      } catch (err: any) {
        console.warn('Solr fallback failed:', err);
      }
    }

    return { records: [], resultCount: 0 };
  }

  /**
   * Normalize VuFind REST record format
   */
  private normalizeRecord(raw: any): VuFindRecord {
    let authorStr = '';
    if (typeof raw.authors === 'object' && raw.authors !== null) {
      if (raw.authors.primary) {
        authorStr = Object.keys(raw.authors.primary).join('; ');
      }
    } else if (typeof raw.author === 'string') {
      authorStr = raw.author;
    }

    return {
      id: raw.id || String(Math.random()),
      title: raw.title || 'Untitled',
      titleFull: raw.titleFull || raw.title,
      authors: authorStr ? [authorStr] : (Array.isArray(raw.authors) ? raw.authors : []),
      publicationDates: Array.isArray(raw.publicationDates) ? raw.publicationDates : (raw.publishDate ? [raw.publishDate] : []),
      publishers: Array.isArray(raw.publishers) ? raw.publishers : (raw.publisher ? [raw.publisher] : []),
      places: Array.isArray(raw.places) ? raw.places : (raw.publishPlace ? [raw.publishPlace] : []),
      formats: Array.isArray(raw.formats) ? raw.formats : (raw.format ? [raw.format] : ['Book']),
      languages: Array.isArray(raw.languages) ? raw.languages : (raw.language ? [raw.language] : []),
      isbns: Array.isArray(raw.isbns) ? raw.isbns : (raw.isbn ? [raw.isbn] : []),
      subjects: Array.isArray(raw.subjects) ? raw.subjects : [],
      callnumber: raw.callnumber,
      source: 'VuFind',
      raw,
    };
  }

  /**
   * Normalize Solr biblio doc format
   */
  private normalizeSolrDoc(doc: any): VuFindRecord {
    return {
      id: doc.id,
      title: doc.title || doc.title_full || 'Untitled',
      titleFull: doc.title_full || doc.title,
      authors: Array.isArray(doc.author) ? doc.author : (doc.author ? [doc.author] : []),
      publicationDates: Array.isArray(doc.publishDate) ? doc.publishDate : (doc.publishDate ? [doc.publishDate] : []),
      publishers: Array.isArray(doc.publisher) ? doc.publisher : (doc.publisher ? [doc.publisher] : []),
      places: Array.isArray(doc.publishPlace) ? doc.publishPlace : (doc.publishPlace ? [doc.publishPlace] : []),
      formats: Array.isArray(doc.format) ? doc.format : ['Book'],
      languages: Array.isArray(doc.language) ? doc.language : [],
      isbns: Array.isArray(doc.isbn) ? doc.isbn : [],
      subjects: doc.topic ? [doc.topic] : [],
      callnumber: doc.callnumber,
      source: 'VuFind Solr',
      raw: doc,
    };
  }

  /**
   * Convert BIBFRAME record (W3C JSON-LD, editor state, or plain record)
   * into a VuFind Solr biblio document
   */
  bibframeToVuFindSolr(bibframe: any): VuFindSolrDoc {
    if (!bibframe) {
      return { id: `bf-${Date.now()}`, title: 'Untitled Resource', format: ['Book'] };
    }

    let work: any = bibframe;
    let instance: any = bibframe;

    if (bibframe['@graph'] && Array.isArray(bibframe['@graph'])) {
      work = bibframe['@graph'].find((n: any) => {
        const t = Array.isArray(n['@type']) ? n['@type'] : [n['@type']];
        return t.includes('bf:Work');
      }) || {};
      instance = bibframe['@graph'].find((n: any) => {
        const t = Array.isArray(n['@type']) ? n['@type'] : [n['@type']];
        return t.includes('bf:Instance');
      }) || work;
    } else if (bibframe.workData || bibframe.instanceData) {
      work = bibframe.workData || {};
      instance = bibframe.instanceData || work;
    } else if (bibframe.work || bibframe.instance) {
      work = bibframe.work || bibframe;
      instance = bibframe.instance || bibframe;
    }

    // ID extraction
    let idStr = instance['@id'] || work['@id'] || `moon-${Date.now()}`;
    if (idStr.includes('/')) {
      idStr = idStr.split('/').pop() || idStr;
    }

    // Title extraction
    let titleStr = 'Untitled Resource';
    const rawTitle = instance['bf:title'] || work['bf:title'] ||
      instance['http://id.loc.gov/ontologies/bibframe/title'] ||
      work['http://id.loc.gov/ontologies/bibframe/title'] ||
      instance.title || work.title;

    if (typeof rawTitle === 'string') {
      titleStr = rawTitle;
    } else if (Array.isArray(rawTitle) && rawTitle.length > 0) {
      const first = rawTitle[0];
      if (typeof first === 'string') titleStr = first;
      else if (first && typeof first === 'object') {
        const mt = first['bf:mainTitle'] || first['http://id.loc.gov/ontologies/bibframe/mainTitle'] || first.mainTitle;
        if (typeof mt === 'string') titleStr = mt;
        else if (Array.isArray(mt) && mt[0]) titleStr = mt[0]?.['@value'] || String(mt[0]);
        else if (mt?.['@value']) titleStr = mt['@value'];
      }
    } else if (typeof rawTitle === 'object' && rawTitle !== null) {
      const mt = rawTitle['bf:mainTitle'] || rawTitle['http://id.loc.gov/ontologies/bibframe/mainTitle'] || rawTitle.mainTitle;
      if (typeof mt === 'string') titleStr = mt;
      else if (Array.isArray(mt) && mt[0]) titleStr = mt[0]?.['@value'] || String(mt[0]);
      else if (mt?.['@value']) titleStr = mt['@value'];
    }

    // Author extraction
    const contribs = work['bf:contribution'] || work['http://id.loc.gov/ontologies/bibframe/contribution'] || work.contribution || work.author || work.creator || [];
    const contribList = Array.isArray(contribs) ? contribs : [contribs];
    const authors: string[] = contribList.map((c: any) => {
      if (typeof c === 'string') return c;
      const agent = c['bf:agent'] || c['http://id.loc.gov/ontologies/bibframe/agent'] || c.agent || {};
      const name = agent['rdfs:label'] || agent.label || agent.name || (typeof agent === 'string' ? agent : (c.name || ''));
      return String(name).trim();
    }).filter(Boolean);

    // Identifiers (ISBNs)
    const ids = instance['bf:identifiedBy'] || instance['http://id.loc.gov/ontologies/bibframe/identifiedBy'] || instance.identifiedBy || (instance.isbn ? [{ value: instance.isbn, '@type': 'bf:Isbn' }] : []);
    const idList = Array.isArray(ids) ? ids : [ids];
    const isbns: string[] = idList.map((id: any) => {
      const val = id['rdf:value'] || id.value || id.isbn || (typeof id === 'string' ? id : '');
      return typeof val === 'object' ? (val['@value'] || '') : String(val);
    }).filter(Boolean);

    // Publication
    const provs = instance['bf:provisionActivity'] || instance['http://id.loc.gov/ontologies/bibframe/provisionActivity'] || instance.provisionActivity || [];
    const provList = Array.isArray(provs) ? provs : [provs];
    const publishers: string[] = [];
    const places: string[] = [];
    const dates: string[] = [];

    provList.forEach((p: any) => {
      const agent = p['bf:agent'] || p['http://id.loc.gov/ontologies/bibframe/agent'] || p.agent;
      const place = p['bf:place'] || p['http://id.loc.gov/ontologies/bibframe/place'] || p.place;
      const date = p['bf:date'] || p['http://id.loc.gov/ontologies/bibframe/date'] || p.date;

      if (agent) {
        publishers.push(typeof agent === 'object' ? (agent['rdfs:label'] || agent.label || '') : String(agent));
      }
      if (place) {
        places.push(typeof place === 'object' ? (place['rdfs:label'] || place.label || '') : String(place));
      }
      if (date) {
        dates.push(typeof date === 'object' ? (date['@value'] || date.value || '') : String(date));
      }
    });

    if (publishers.length === 0 && instance.publisher) publishers.push(String(instance.publisher));
    if (dates.length === 0 && instance.publicationDate) dates.push(String(instance.publicationDate));
    if (places.length === 0 && instance.publicationPlace) places.push(String(instance.publicationPlace));

    // Subjects
    const subjectsRaw = work['bf:subject'] || work['http://id.loc.gov/ontologies/bibframe/subject'] || work.subject || [];
    const subjectList = Array.isArray(subjectsRaw) ? subjectsRaw : [subjectsRaw];
    const topics = subjectList.map((s: any) => {
      return typeof s === 'object' ? (s['rdfs:label'] || s.label || s.term || '') : String(s);
    }).filter(Boolean);

    return {
      id: idStr,
      title: titleStr,
      title_full: titleStr,
      title_sort: titleStr.toLowerCase(),
      author: authors[0] || 'Unknown Author',
      author_additional: authors.slice(1),
      publishDate: dates.filter(Boolean),
      publisher: publishers.filter(Boolean),
      publishPlace: places.filter(Boolean),
      isbn: isbns,
      format: ['Book'],
      language: ['ara', 'eng'],
      topic: topics,
      record_format: 'bibframe',
      fulltext: `${titleStr} ${authors.join(' ')} ${topics.join(' ')} ${publishers.join(' ')}`,
    };
  }

  /**
   * Index document directly into VuFind Solr biblio core
   */
  async indexToSolr(solrDoc: VuFindSolrDoc): Promise<{ success: boolean; message?: string }> {
    if (!this.config.solrUrl) {
      throw new Error('Solr URL is not configured.');
    }

    const updateUrl = `${this.config.solrUrl}/update/json/docs?commit=true`;
    const response = await fetch(updateUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(solrDoc),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Failed to index to Solr: ${response.statusText} - ${errText}`);
    }

    return { success: true, message: `Indexed into Solr core with ID: ${solrDoc.id}` };
  }

  /**
   * Convert VuFind discovery record into Moon BIBFRAME format for editing
   */
  vufindRecordToBibframe(rec: VuFindRecord): any {
    return {
      work: {
        title: rec.title,
        // VuFind's REST API gives authors as { primary: { "Name": roles } }; Solr docs give a list.
        author: Array.isArray(rec.authors) ? rec.authors[0] || '' : Object.keys(rec.authors?.primary || {})[0] || '',
        subjects: rec.subjects ? rec.subjects.flat() : [],
        language: (rec.languages && rec.languages[0]) || 'ara',
      },
      instance: {
        title: rec.titleFull || rec.title,
        publisher: (rec.publishers && rec.publishers[0]) || '',
        publicationDate: (rec.publicationDates && rec.publicationDates[0]) || '',
        publicationPlace: (rec.places && rec.places[0]) || '',
        isbn: (rec.isbns && rec.isbns[0]) || '',
      },
      admin: {
        source: 'VuFind Discovery Portal',
        vufindId: rec.id,
      },
    };
  }
}

export function initializeVuFindClient(config: Partial<VuFindConfig> = {}): VuFindApiClient {
  return new VuFindApiClient(config);
}
