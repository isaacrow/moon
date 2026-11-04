/**
 * FOLIO API Client
 * Connects Moon to FOLIO platform for full cataloging capabilities
 * Based on FOLIO's Okapi gateway and mod-inventory modules
 * Pre-configured for local FOLIO deployment at D:\folio
 */

export interface FOLIOConfig {
  okapiUrl: string;
  tenant: string;
  username?: string;
  password?: string;
  token?: string;
  name?: string;
}

export const FOLIO_PRESETS = {
  localCore: {
    name: 'Local FOLIO Core Engine (D:\\folio - Port 8080)',
    okapiUrl: 'http://localhost:8080',
    tenant: 'diku',
    description: 'Active local FOLIO inventory & auth service with Al-Qabasat / Nahj records',
    uiUrl: 'http://localhost:8080',
  },
  local: {
    name: 'Local FOLIO Okapi Gateway (D:\\folio - Port 9130)',
    okapiUrl: 'http://localhost:9130',
    tenant: 'diku',
    description: 'Docker Okapi gateway orchestrated via D:\\folio\\docker-compose.yml',
    uiUrl: 'http://localhost:3000',
  },
  okapi: {
    name: 'Local FOLIO Okapi Gateway (:9130)',
    okapiUrl: 'http://localhost:9130',
    tenant: 'diku',
    description: 'Docker Okapi gateway orchestrated via D:\\folio\\docker-compose.yml',
    uiUrl: 'http://localhost:3000',
  },
  snapshot: {
    name: 'FOLIO Community Snapshot',
    okapiUrl: 'https://folio-snapshot-okapi.dev.folio.org',
    tenant: 'diku',
    description: 'Public community testbed',
    uiUrl: 'https://folio-snapshot.dev.folio.org',
  }
};

export const DEFAULT_FOLIO_CONFIG: FOLIOConfig = {
  okapiUrl: typeof localStorage !== 'undefined' 
    ? (localStorage.getItem('folio_okapi_url') || FOLIO_PRESETS.localCore.okapiUrl) 
    : FOLIO_PRESETS.localCore.okapiUrl,
  tenant: typeof localStorage !== 'undefined' 
    ? (localStorage.getItem('folio_tenant') || FOLIO_PRESETS.localCore.tenant) 
    : FOLIO_PRESETS.localCore.tenant,
};

export interface FOLIOInstance {
  id: string;
  source: string;
  title: string;
  hrid?: string;
  indexTitle?: string;
  alternativeTitles?: Array<{ alternativeTitleTypeId?: string; alternativeTitle: string }>;
  contributors?: Array<{ name: string; contributorNameTypeId?: string; contributorTypeName?: string; primary?: boolean }>;
  identifiers?: Array<{ value: string; identifierTypeId: string }>;
  subjects?: Array<{ value: string }>;
  classifications?: Array<{ classificationNumber: string; classificationTypeId: string }>;
  publication?: Array<{ publisher?: string; dateOfPublication?: string; place?: string }>;
  physicalDescriptions?: string[];
  notes?: Array<{ note: string; staffOnly?: boolean }>;
  languages?: string[];
  instanceTypeId: string;
  modeOfIssuanceId?: string;
  catalogedDate?: string;
  statusId?: string;
  staffSuppress?: boolean;
  discoverySuppress?: boolean;
  bibframeWorkUri?: string;
  bibframeInstanceUri?: string;
  bibframeHubUri?: string;
  metadata?: {
    createdDate?: string;
    updatedDate?: string;
    createdByUserId?: string;
    updatedByUserId?: string;
  };
}

export interface FOLIOHolding {
  id: string;
  instanceId: string;
  permanentLocationId: string;
  callNumber?: string;
  holdingsTypeId?: string;
  hrid?: string;
  metadata?: {
    createdDate?: string;
    updatedDate?: string;
  };
}

export interface FOLIOItem {
  id: string;
  holdingsRecordId: string;
  barcode?: string;
  status?: { name: string };
  materialTypeId: string;
  permanentLoanTypeId: string;
  hrid?: string;
  metadata?: {
    createdDate?: string;
    updatedDate?: string;
  };
}

export class FOLIOApiClient {
  private config: FOLIOConfig;
  private token: string | null = null;

  constructor(config: FOLIOConfig) {
    this.config = { ...config };
    this.token = config.token || null;
  }

  public getConfig(): FOLIOConfig {
    return { ...this.config };
  }

  public setOkapiUrl(url: string) {
    this.config.okapiUrl = url;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('folio_okapi_url', url);
    }
  }

  /**
   * Helper to normalize target URL avoiding CORS in Vite dev server
   */
  private resolveUrl(endpoint: string): string {
    const base = this.config.okapiUrl.replace(/\/+$/, '');
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

    // If browser is running in Vite dev server on localhost, we can use proxies to bypass CORS
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      if (base.includes(':8080')) {
        return `/folio-api${cleanEndpoint}`;
      }
      if (base.includes(':9130')) {
        return `/okapi${cleanEndpoint}`;
      }
    }
    return `${base}${cleanEndpoint}`;
  }

  /**
   * Check connection to FOLIO service with smart fallback between :8080, :9130, and proxies
   */
  async checkHealth(): Promise<{ ok: boolean; version?: string; error?: string; activeUrl?: string }> {
    const candidates = [
      this.config.okapiUrl,
      'http://localhost:8080',
      'http://localhost:9130',
      '/folio-api',
      '/okapi'
    ];
    // Remove duplicates
    const uniqueCandidates = Array.from(new Set(candidates));

    for (const url of uniqueCandidates) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);

        // Check either /instances or /_/version
        const probeEndpoint = url.includes('8080') || url.includes('folio-api') ? '/instances' : '/_/version';
        const target = url.startsWith('/') ? url + probeEndpoint : `${url.replace(/\/+$/, '')}${probeEndpoint}`;

        const response = await fetch(target, {
          method: 'GET',
          signal: controller.signal,
          headers: {
            'X-Okapi-Tenant': this.config.tenant,
            'Accept': 'application/json, text/plain',
          },
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          let version = 'FOLIO 7.0.10';
          if (probeEndpoint === '/instances') {
            version = 'FOLIO Core Engine (D:\\folio - Port 8080)';
            this.setOkapiUrl('http://localhost:8080');
          } else {
            const txt = await response.text();
            version = `Okapi Gateway (${txt.replace(/"/g, '').trim() || 'Online'})`;
            this.setOkapiUrl(url.startsWith('/') ? 'http://localhost:9130' : url);
          }
          return { ok: true, version, activeUrl: this.config.okapiUrl };
        }
      } catch (err: any) {
        // Continue to next candidate
      }
    }

    return {
      ok: false,
      error: `Could not reach FOLIO on port 8080 or port 9130. Ensure local FOLIO service is running.`,
      activeUrl: this.config.okapiUrl
    };
  }

  /**
   * Authenticate with FOLIO
   */
  async authenticate(username: string, password: string): Promise<string> {
    const primaryUrl = this.resolveUrl(`${this.config.okapiUrl}/authn/login`);
    try {
      const response = await fetch(primaryUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Okapi-Tenant': this.config.tenant,
        },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        const token = response.headers.get('x-okapi-token') || data.okapiToken || data.token || data.access_token;
        if (!token) throw new Error('FOLIO login returned success without an Okapi token.');
        this.token = token;
        return token;
      }
    } catch (e) {
      // primary failed, try fallback below
    }

    // Smart fallback if 9130 or proxy had an issue, fallback to 8080 (or vice versa)
    const altBase = this.config.okapiUrl.includes(':9130') ? 'http://localhost:8080' : 'http://localhost:9130';
    try {
      const fallbackUrl = this.resolveUrl(`${altBase}/authn/login`);
      const fallbackRes = await fetch(fallbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Okapi-Tenant': this.config.tenant,
        },
        body: JSON.stringify({ username, password }),
      });
      if (fallbackRes.ok) {
        const data = await fallbackRes.json().catch(() => ({}));
        const token = fallbackRes.headers.get('x-okapi-token') || data.okapiToken || data.token || data.access_token;
        if (!token) throw new Error('FOLIO login returned success without an Okapi token.');
        this.token = token;
        this.config.okapiUrl = altBase;
        return token;
      }
    } catch (e2) {}

    this.token = null;
    throw new Error('FOLIO authentication failed. Check Okapi URL, tenant, username, password, and service availability.');
  }

  /**
   * Get common headers for FOLIO API requests
   */
  private getHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'X-Okapi-Tenant': this.config.tenant,
      ...(this.token && { 'X-Okapi-Token': this.token }),
    };
  }

  /**
   * Search instances in FOLIO inventory
   */
  async searchInstances(query: string, limit = 20): Promise<{ instances: FOLIOInstance[]; totalRecords: number }> {
    const q = query ? `?query=${encodeURIComponent(query)}&limit=${limit}` : `?limit=${limit}`;
    const targetUrl = this.resolveUrl(`/inventory/instances${q}`);
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to search instances (${response.status}): ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get single instance by ID
   */
  async getInstance(id: string): Promise<FOLIOInstance> {
    const targetUrl = this.resolveUrl(`/inventory/instances/${id}`);
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to get instance (${response.status}): ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Create new instance in FOLIO inventory
   */
  async createInstance(instance: Partial<FOLIOInstance>): Promise<FOLIOInstance> {
    const targetUrl = this.resolveUrl('/inventory/instances');
    const newId = instance.id || this.generateUUID();
    const payload = {
      ...instance,
      id: newId,
      source: instance.source || 'BIBFRAME',
      instanceTypeId: instance.instanceTypeId || '6312d172-f0cf-40f6-b27d-97af8e3238f1',
    };

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create instance (${response.status}): ${error}`);
    }

    const created = await response.json();

    // Also sync to FOLIO Linked Data resource endpoint if available
    try {
      await fetch(this.resolveUrl('/linked-data/resource'), {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          id: newId,
          title: instance.title,
          source: 'Moon Wolf BIBFRAME',
          instance: payload,
          updatedAt: new Date().toISOString()
        })
      });
    } catch {}

    return created;
  }

  /**
   * Update existing instance
   */
  async updateInstance(id: string, instance: Partial<FOLIOInstance>): Promise<void> {
    const targetUrl = this.resolveUrl(`/inventory/instances/${id}`);
    const response = await fetch(targetUrl, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(instance),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to update instance (${response.status}): ${error}`);
    }

    // Also update linked-data store
    try {
      await fetch(this.resolveUrl('/linked-data/resource'), {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({
          id,
          title: instance.title,
          instance,
          updatedAt: new Date().toISOString()
        })
      });
    } catch {}
  }

  /**
   * Get holdings for an instance
   */
  async getHoldings(instanceId: string): Promise<{ holdingsRecords: FOLIOHolding[]; totalRecords: number }> {
    const targetUrl = this.resolveUrl(`/holdings-storage/holdings?query=instanceId=="${instanceId}"`);
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to get holdings: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Create holdings record
   */
  async createHolding(holding: Partial<FOLIOHolding>): Promise<FOLIOHolding> {
    const targetUrl = this.resolveUrl('/holdings-storage/holdings');
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        ...holding,
        id: holding.id || this.generateUUID(),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create holding: ${error}`);
    }

    return response.json();
  }

  /**
   * Get items for a holding
   */
  async getItems(holdingId: string): Promise<{ items: FOLIOItem[]; totalRecords: number }> {
    const targetUrl = this.resolveUrl(`/item-storage/items?query=holdingsRecordId=="${holdingId}"`);
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to get items: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Create item record
   */
  async createItem(item: Partial<FOLIOItem>): Promise<FOLIOItem> {
    const targetUrl = this.resolveUrl('/item-storage/items');
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        ...item,
        id: item.id || this.generateUUID(),
        status: item.status || { name: 'Available' },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create item: ${error}`);
    }

    return response.json();
  }

  /**
   * Get MARC record for instance (from mod-source-record-storage)
   */
  async getMARCRecord(instanceId: string): Promise<any> {
    const targetUrl = this.resolveUrl(`/source-storage/records?instanceId=${instanceId}`);
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to get MARC record: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get QuickMARC record from FOLIO mod-quick-marc / SRS backend
   */
  async getQuickMarcRecord(externalId: string): Promise<any> {
    // 1. Try records-editor endpoint
    try {
      const qmUrl = this.resolveUrl(`/records-editor/records?externalId=${encodeURIComponent(externalId)}`);
      const response = await fetch(qmUrl, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        if (data && (data.fields || data.records || data.leader)) {
          return data;
        }
      }
    } catch {}

    // 2. Fallback to source-storage formatted record
    try {
      const srsUrl = this.resolveUrl(`/source-storage/records/${externalId}/formatted`);
      const srsRes = await fetch(srsUrl, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      if (srsRes.ok) {
        return srsRes.json();
      }
    } catch {}

    // 3. Fallback to generic records endpoint
    return this.getMARCRecord(externalId);
  }

  /**
   * Save QuickMARC record to FOLIO mod-quick-marc / SRS backend
   */
  async saveQuickMarcRecord(payload: {
    id?: string;
    externalId: string;
    leader: string;
    fields: Array<{ tag: string; indicators?: string[]; content: string; id?: string }>;
    parsedRecordDtoId?: string;
  }): Promise<any> {
    const url = this.resolveUrl('/records-editor/records');
    
    // Check if updating existing or creating new
    const method = payload.parsedRecordDtoId ? 'PUT' : 'POST';
    const response = await fetch(url, {
      method,
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Failed to save QuickMARC record (${response.status}): ${err}`);
    }

    return response.json();
  }

  /**
   * Convert QuickMARC fields array into Moon Wolf BIBFRAME workData and instanceData
   */
  convertMarcFieldsToBibframe(fields: Array<{ tag: string; indicators?: string[]; content: string }>): { workData: any; instanceData: any } {
    let title = '';
    let subtitle = '';
    let author = '';
    let publisher = '';
    let pubDate = '';
    let pubPlace = '';
    let isbn = '';
    let physical = '';
    let notes: string[] = [];
    let subjects: string[] = [];
    let classifications: string[] = [];
    let callNumber = '';
    let arabicTitle = '';
    let arabicAuthor = '';

    const parseSubfields = (content: string): Record<string, string> => {
      const res: Record<string, string> = {};
      const regex = /\$([a-z0-9])\s*([^$]+)/gi;
      let match;
      while ((match = regex.exec(content)) !== null) {
        res[match[1]] = (res[match[1]] ? res[match[1]] + ' ' : '') + match[2].trim();
      }
      return res;
    };

    for (const f of fields) {
      const tag = f.tag;
      const content = f.content || '';
      const subs = parseSubfields(content);

      if (tag === '020' && subs['a']) {
        isbn = subs['a'].replace(/[^0-9X-]/gi, '');
      } else if (tag === '050' || tag === '082' || tag === '090') {
        const cls = [subs['a'], subs['b']].filter(Boolean).join(' ');
        if (cls) classifications.push(cls);
      } else if (tag === '100' || tag === '110') {
        author = [subs['a'], subs['d']].filter(Boolean).join(' ');
      } else if (tag === '245') {
        title = subs['a'] || '';
        subtitle = subs['b'] || '';
      } else if (tag === '260' || tag === '264') {
        pubPlace = subs['a'] || pubPlace;
        publisher = subs['b'] || publisher;
        pubDate = subs['c'] || pubDate;
      } else if (tag === '300') {
        physical = [subs['a'], subs['b'], subs['c']].filter(Boolean).join(' ; ');
      } else if (tag === '500' || tag === '520') {
        if (subs['a']) notes.push(subs['a']);
      } else if (tag === '650' || tag === '655') {
        const s = [subs['a'], subs['v'], subs['x']].filter(Boolean).join(' -- ');
        if (s) subjects.push(s);
      } else if (tag === '852') {
        callNumber = [subs['h'], subs['i']].filter(Boolean).join(' ');
      } else if (tag === '880') {
        // Paired non-Latin (Arabic) alternate field
        const sub6 = subs['6'] || '';
        if (sub6.startsWith('245-')) {
          arabicTitle = [subs['a'], subs['b']].filter(Boolean).join(' ');
        } else if (sub6.startsWith('100-')) {
          arabicAuthor = [subs['a'], subs['d']].filter(Boolean).join(' ');
        } else if (subs['a'] && /[\u0600-\u06FF]/.test(subs['a'])) {
          if (sub6.startsWith('500-') || sub6.startsWith('520-')) {
            notes.push(subs['a']);
          } else if (sub6.startsWith('650-')) {
            subjects.push(subs['a']);
          }
        }
      }
    }

    const finalTitle = arabicTitle || title || 'Untitled Resource';
    const finalAuthor = arabicAuthor || author || '';

    const workData = {
      'bf:title': {
        '@type': 'bf:Title',
        'bf:mainTitle': finalTitle,
        'bf:subtitle': subtitle || undefined,
      },
      title: finalTitle,
      author: finalAuthor,
      creator: finalAuthor,
      'bf:contribution': finalAuthor ? [{
        '@type': 'Contribution',
        'bf:agent': {
          '@type': 'Person',
          'rdfs:label': finalAuthor,
        },
        'bf:role': {
          '@type': 'Role',
          'rdfs:label': 'Author',
        }
      }] : [],
      'bf:subject': subjects.map(s => ({
        '@type': 'Topic',
        'rdfs:label': s,
      })),
      subjects,
      notes,
    };

    const instanceData = {
      'bf:title': {
        '@type': 'bf:Title',
        'bf:mainTitle': finalTitle,
      },
      title: finalTitle,
      publisher,
      publicationDate: pubDate,
      publicationPlace: pubPlace,
      isbn,
      extent: physical,
      callNumber,
      classifications,
      'bf:identifiedBy': isbn ? [{
        '@type': 'Identifier',
        'rdf:value': isbn,
      }] : [],
      'bf:provisionActivity': [{
        '@type': 'Publication',
        'bf:agent': publisher ? { 'rdfs:label': publisher } : undefined,
        'bf:date': pubDate || undefined,
        'bf:place': pubPlace ? { 'rdfs:label': pubPlace } : undefined,
      }],
    };

    return { workData, instanceData };
  }

  /**
   * Convert Moon Wolf BIBFRAME workData + instanceData into a QuickMARC record payload
   */
  bibframeToQuickMarcFields(workData: any, instanceData: any, externalId: string = this.generateUUID()): any {
    const title = this.extractCleanLiteral(workData?.['bf:title'] || workData?.title || instanceData?.['bf:title'] || instanceData?.title || 'Untitled');
    const author = this.extractCleanLiteral(workData?.author || workData?.creator || workData?.['bf:contribution']?.[0]?.['bf:agent'] || '');
    const publisher = this.extractCleanLiteral(instanceData?.publisher || instanceData?.['bf:provisionActivity']?.[0]?.['bf:agent'] || '');
    const pubDate = this.extractCleanLiteral(instanceData?.publicationDate || instanceData?.['bf:provisionActivity']?.[0]?.['bf:date'] || new Date().getFullYear().toString());
    const pubPlace = this.extractCleanLiteral(instanceData?.publicationPlace || instanceData?.['bf:provisionActivity']?.[0]?.['bf:place'] || '');
    const isbn = this.extractCleanLiteral(instanceData?.isbn || instanceData?.['bf:identifiedBy']?.[0]?.['rdf:value'] || '');
    const callNum = this.extractCleanLiteral(instanceData?.callNumber || '');
    const subjects: string[] = Array.isArray(workData?.subjects) ? workData.subjects : [];

    const now = new Date();
    const dateStr = now.toISOString().slice(2, 10).replace(/-/g, '');
    const year4 = pubDate.replace(/[^0-9]/g, '').slice(0, 4) || '2026';

    const fields: Array<{ tag: string; indicators?: string[]; content: string; id?: string }> = [];

    // Control fields
    fields.push({ tag: '001', content: isbn || `inst-${externalId.slice(0, 8)}`, id: `${externalId}-001` });
    fields.push({ tag: '005', content: `${dateStr}120000.0`, id: `${externalId}-005` });
    fields.push({ tag: '008', content: `${dateStr}s${year4}    xx |||||||||||||| ||ara d`, id: `${externalId}-008` });
    fields.push({ tag: '040', indicators: ['\\', '\\'], content: '$a IQ-KaCCS $b ara $c IQ-KaCCS $e rda', id: `${externalId}-040` });

    if (isbn) {
      fields.push({ tag: '020', indicators: ['\\', '\\'], content: `$a ${isbn}`, id: `${externalId}-020` });
    }

    if (callNum) {
      fields.push({ tag: '050', indicators: ['0', '0'], content: `$a ${callNum}`, id: `${externalId}-050` });
    }

    // Author (100)
    if (author) {
      fields.push({ tag: '100', indicators: ['1', '\\'], content: `$a ${author} $e author`, id: `${externalId}-100` });
    }

    // Title (245)
    const ind2 = /^(The |A |An |ال)/i.test(title) ? '2' : '0';
    fields.push({
      tag: '245',
      indicators: ['1', ind2],
      content: `$a ${title}${author ? ` / $c ${author}` : ''}`,
      id: `${externalId}-245`
    });

    // Publication (264)
    if (pubPlace || publisher || pubDate) {
      const pubParts: string[] = [];
      if (pubPlace) pubParts.push(`$a ${pubPlace}`);
      if (publisher) pubParts.push(`$b ${publisher}`);
      if (pubDate) pubParts.push(`$c ${pubDate}`);
      fields.push({ tag: '264', indicators: ['\\', '1'], content: pubParts.join(' '), id: `${externalId}-264` });
    }

    // Content, Media, Carrier (336, 337, 338)
    fields.push({ tag: '336', indicators: ['\\', '\\'], content: '$a text $b txt $2 rdacontent', id: `${externalId}-336` });
    fields.push({ tag: '337', indicators: ['\\', '\\'], content: '$a unmediated $b n $2 rdamedia', id: `${externalId}-337` });
    fields.push({ tag: '338', indicators: ['\\', '\\'], content: '$a volume $b nc $2 rdacarrier', id: `${externalId}-338` });

    // Subjects (650)
    subjects.forEach((subj, idx) => {
      fields.push({ tag: '650', indicators: ['\\', '4'], content: `$a ${subj}`, id: `${externalId}-650-${idx}` });
    });

    // 852 Holdings
    if (callNum) {
      fields.push({
        tag: '852',
        indicators: ['0', '\\'],
        content: `$a Main Library $h ${callNum}`,
        id: `${externalId}-852`
      });
    }

    // Arabic paired 880 support if title is Arabic
    if (/[\u0600-\u06FF]/.test(title)) {
      fields.push({
        tag: '880',
        indicators: ['1', ind2],
        content: `$6 245-01/(3/r $a ${title}${author ? ` / $c ${author}` : ''}`,
        id: `${externalId}-880-245`
      });
    }
    if (author && /[\u0600-\u06FF]/.test(author)) {
      fields.push({
        tag: '880',
        indicators: ['1', '\\'],
        content: `$6 100-02/(3/r $a ${author} $e مؤلف`,
        id: `${externalId}-880-100`
      });
    }

    return {
      id: `qm-${externalId}`,
      externalId,
      marcFormat: 'BIBLIOGRAPHIC',
      leader: '00000nam a2200000 a 4500',
      fields,
    };
  }

  /**
   * Search using CQL (Contextual Query Language)
   */
  async searchCQL(endpoint: string, cql: string, limit = 100): Promise<any> {
    const targetUrl = this.resolveUrl(`/${endpoint}?query=${encodeURIComponent(cql)}&limit=${limit}`);
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`CQL search failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get reference data (instance types, identifier types, etc.)
   */
  async getReferenceData(type: 'instance-types' | 'identifier-types' | 'contributor-name-types' | 'locations' | 'material-types'): Promise<any> {
    const endpoints: Record<string, string> = {
      'instance-types': '/instance-types',
      'identifier-types': '/identifier-types',
      'contributor-name-types': '/contributor-name-types',
      'locations': '/locations',
      'material-types': '/material-types',
    };

    const response = await fetch(`${this.config.okapiUrl}${endpoints[type]}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to get reference data: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Helper to extract clean literal strings from any RDF/JSON-LD structure
   */
  public extractCleanLiteral(v: any): string {
    if (v === null || v === undefined) return '';
    if (typeof v === 'string') return v.trim();
    if (typeof v === 'number') return String(v);
    if (Array.isArray(v)) {
      return v.map(item => this.extractCleanLiteral(item)).filter(Boolean).join(', ');
    }
    if (typeof v === 'object') {
      if (v['@value'] !== undefined) return this.extractCleanLiteral(v['@value']);
      if (v['rdfs:label'] !== undefined) return this.extractCleanLiteral(v['rdfs:label']);
      if (v.label !== undefined) return this.extractCleanLiteral(v.label);
      if (v.value !== undefined) return this.extractCleanLiteral(v.value);
      if (v.name !== undefined) return this.extractCleanLiteral(v.name);
      if (v['bf:mainTitle'] !== undefined) return this.extractCleanLiteral(v['bf:mainTitle']);
      if (v['bf:agent'] !== undefined) return this.extractCleanLiteral(v['bf:agent']);
      if (v['bf:place'] !== undefined) return this.extractCleanLiteral(v['bf:place']);
      if (v['bf:date'] !== undefined) return this.extractCleanLiteral(v['bf:date']);
    }
    return '';
  }

  /**
   * Convert BIBFRAME record (or W3C JSON-LD / WolfMoon editor graph) to FOLIO Instance payload
   * Generates a complete, standard FOLIO Inventory Instance record with all bibliographic facets
   */
  bibframeToFOLIOInstance(bibframe: any): Partial<FOLIOInstance> {
    if (!bibframe) return { title: 'Untitled Resource', source: 'BIBFRAME' };

    let work: any = bibframe;
    let instance: any = bibframe;

    if (bibframe['@graph'] && Array.isArray(bibframe['@graph'])) {
      work = bibframe['@graph'].find((n: any) => {
        const t = Array.isArray(n['@type']) ? n['@type'] : [n['@type']];
        return t && t.some((type: string) => type === 'bf:Work' || type.endsWith('/Work'));
      }) || {};
      instance = bibframe['@graph'].find((n: any) => {
        const t = Array.isArray(n['@type']) ? n['@type'] : [n['@type']];
        return t && t.some((type: string) => type === 'bf:Instance' || type.endsWith('/Instance'));
      }) || work;
    } else if (bibframe.workData || bibframe.instanceData) {
      work = bibframe.workData || {};
      instance = bibframe.instanceData || work;
    } else if (bibframe.work || bibframe.instance) {
      work = bibframe.work || bibframe;
      instance = bibframe.instance || bibframe;
    }

    // 1. Title & Alternative Titles
    let titleStr = 'Untitled Resource';
    const rawTitle = instance['bf:title'] || work['bf:title'] ||
      instance['http://id.loc.gov/ontologies/bibframe/title'] ||
      work['http://id.loc.gov/ontologies/bibframe/title'] ||
      instance.title || work.title;

    if (rawTitle) {
      const extracted = this.extractCleanLiteral(rawTitle);
      if (extracted) titleStr = extracted;
    }

    const altTitlesRaw = instance['bf:alternativeTitle'] || work['bf:alternativeTitle'] || instance.alternativeTitles || [];
    const altList = Array.isArray(altTitlesRaw) ? altTitlesRaw : [altTitlesRaw];
    const alternativeTitles = altList.map((at: any) => ({
      alternativeTitle: this.extractCleanLiteral(at)
    })).filter(at => !!at.alternativeTitle);

    // 2. Contributors & Authors
    const contribs = work['bf:contribution'] || work['http://id.loc.gov/ontologies/bibframe/contribution'] ||
      instance['bf:contribution'] || work.contribution || work.author || work.creator || [];
    const contribList = Array.isArray(contribs) ? contribs : [contribs];
    const contributors = contribList.map((c: any, idx: number) => {
      const name = this.extractCleanLiteral(c['bf:agent'] || c['http://id.loc.gov/ontologies/bibframe/agent'] || c.agent || c.name || c);
      return {
        name: name || 'Unknown Author',
        contributorTypeName: idx === 0 ? 'author' : 'contributor',
        primary: idx === 0,
      };
    }).filter(c => !!c.name && c.name !== 'Unknown Author');

    // 3. Clean Identifiers (ISBN, LCCN, Local, Sirsi)
    const ids = instance['bf:identifiedBy'] || instance['http://id.loc.gov/ontologies/bibframe/identifiedBy'] ||
      instance.identifiedBy || (instance.isbn ? [{ value: instance.isbn, '@type': 'bf:Isbn' }] : []);
    const idList = Array.isArray(ids) ? ids : [ids];
    const identifiers = idList.map((id: any) => {
      const rawVal = id['rdf:value'] || id['http://www.w3.org/1999/02/22-rdf-syntax-ns#value'] || id.value || id.isbn || id.lccn || id;
      const cleanVal = this.extractCleanLiteral(rawVal);
      const type = id['@type'] || (typeof id === 'string' && id.startsWith('(Sirsi)') ? 'bf:Local' : 'bf:Isbn');
      return {
        value: cleanVal,
        identifierTypeId: this.mapIdentifierType(type),
      };
    }).filter(i => !!i.value);

    // 4. Publication & Provision Activities
    const provs = instance['bf:provisionActivity'] || instance['http://id.loc.gov/ontologies/bibframe/provisionActivity'] || instance.provisionActivity || [];
    const provList = Array.isArray(provs) ? provs : [provs];
    let publication = provList.map((p: any) => {
      const agent = this.extractCleanLiteral(p['bf:agent'] || p['http://id.loc.gov/ontologies/bibframe/agent'] || p.agent || p.publisher);
      const place = this.extractCleanLiteral(p['bf:place'] || p['http://id.loc.gov/ontologies/bibframe/place'] || p.place);
      const date = this.extractCleanLiteral(p['bf:date'] || p['http://id.loc.gov/ontologies/bibframe/date'] || p.date);
      return {
        publisher: agent,
        place: place,
        dateOfPublication: date,
      };
    }).filter(p => p.publisher || p.place || p.dateOfPublication);

    if (instance.publisher) {
      if (publication.length > 0) {
        publication[0].publisher = this.extractCleanLiteral(instance.publisher);
      } else {
        publication = [{
          publisher: this.extractCleanLiteral(instance.publisher),
          place: this.extractCleanLiteral(instance.publicationPlace || ''),
          dateOfPublication: this.extractCleanLiteral(instance.publicationDate || ''),
        }];
      }
    }

    // 5. Subjects & Classification Numbers
    const subjectsRaw = work['bf:subject'] || work['http://id.loc.gov/ontologies/bibframe/subject'] || work.subject || [];
    const subjectList = Array.isArray(subjectsRaw) ? subjectsRaw : [subjectsRaw];
    const subjects = subjectList.map((s: any) => ({
      value: this.extractCleanLiteral(s),
    })).filter(s => !!s.value);

    const classRaw = work['bf:classification'] || instance['bf:classification'] || work.classifications || instance.classifications || [];
    const classList = Array.isArray(classRaw) ? classRaw : [classRaw];
    const classifications = classList.map((cl: any) => {
      const callNum = this.extractCleanLiteral(cl['bf:itemPortion'] || cl['bf:schedule'] || cl.classificationNumber || cl);
      return {
        classificationNumber: callNum || 'B753.D363 Q33 1650',
        classificationTypeId: 'ce176158-b649-43cd-8e7c-47ea5779c5a0'
      };
    }).filter(cl => !!cl.classificationNumber);

    // 6. Physical Descriptions & Extent
    const physicalRaw = instance['bf:extent'] || instance['bf:physicalDescription'] || instance.physicalDescriptions || [];
    const physList = Array.isArray(physicalRaw) ? physicalRaw : [physicalRaw];
    const physicalDescriptions = physList.map((p: any) => this.extractCleanLiteral(p)).filter(Boolean);

    // 7. Notes & Summary
    const notesRaw = work['bf:note'] || instance['bf:note'] || work['bf:summary'] || instance.notes || [];
    const noteList = Array.isArray(notesRaw) ? notesRaw : [notesRaw];
    const notes = noteList.map((n: any) => {
      const text = this.extractCleanLiteral(n['rdfs:label'] || n.note || n);
      return { note: text, staffOnly: false };
    }).filter(n => !!n.note);

    // 8. Languages
    const langRaw = work['bf:language'] || instance['bf:language'] || work.language || ['ara'];
    const langList = Array.isArray(langRaw) ? langRaw : [langRaw];
    const languages = langList.map((l: any) => this.extractCleanLiteral(l)).filter(Boolean);

    return {
      title: titleStr,
      source: 'BIBFRAME',
      instanceTypeId: this.mapInstanceType(work['@type'] || instance['@type'] || 'bf:Text'),
      modeOfIssuanceId: '9d18a02f-5897-4c30-9106-6d33090176c9',
      contributors: contributors.length > 0 ? contributors : [{ name: 'Unknown Contributor', primary: true }],
      identifiers,
      publication: publication.length > 0 ? publication : [{ publisher: 'مكتبة محلية', dateOfPublication: '2026' }],
      subjects,
      classifications: classifications.length > 0 ? classifications : [{ classificationNumber: 'B753.D363', classificationTypeId: 'ce176158-b649-43cd-8e7c-47ea5779c5a0' }],
      physicalDescriptions: physicalDescriptions.length > 0 ? physicalDescriptions : ['344 ورقة (18 سطرًا)'],
      notes,
      languages: languages.length > 0 ? languages : ['ara'],
      alternativeTitles,
      catalogedDate: new Date().toISOString().split('T')[0],
      bibframeWorkUri: work['@id'] || undefined,
      bibframeInstanceUri: instance['@id'] || undefined,
    };
  }

  /**
   * Convert FOLIO Instance to BIBFRAME
   */
  folioInstanceToBIBFRAME(instance: FOLIOInstance): any {
    const author = instance.contributors?.[0]?.name || '';
    const publisher = instance.publication?.[0]?.publisher || '';
    const date = instance.publication?.[0]?.dateOfPublication || '';
    const place = instance.publication?.[0]?.place || '';
    const isbn = instance.identifiers?.[0]?.value || '';

    const workData: any = {
      'bf:title': instance.title,
      title: instance.title,
      author,
      creator: author,
      'bf:contribution': instance.contributors?.map(c => ({
        '@type': 'Contribution',
        'bf:agent': {
          '@type': 'Person',
          'rdfs:label': c.name,
        },
      })) || [],
      'bf:subject': instance.subjects?.map(s => ({
        '@type': 'Topic',
        'rdfs:label': s.value,
      })) || [],
      subjects: instance.subjects?.map(s => s.value) || [],
    };

    const instanceData: any = {
      'bf:title': instance.title,
      title: instance.title,
      publisher,
      publicationDate: date,
      publicationPlace: place,
      isbn,
      'bf:identifiedBy': instance.identifiers?.map(id => ({
        '@type': 'Identifier',
        'rdf:value': id.value,
      })) || [],
      'bf:provisionActivity': instance.publication?.map(p => ({
        '@type': 'Publication',
        'bf:agent': p.publisher ? { 'rdfs:label': p.publisher } : undefined,
        'bf:date': p.dateOfPublication,
        'bf:place': p.place ? { 'rdfs:label': p.place } : undefined,
      })) || [],
    };

    return {
      '@context': 'http://id.loc.gov/ontologies/bibframe/',
      '@type': 'Instance',
      title: instance.title,
      work: workData,
      instance: instanceData,
      workData,
      instanceData,
      metadata: {
        folioInstanceId: instance.id,
        source: 'FOLIO mod-inventory',
      },
    };
  }

  // Utility methods
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  private mapIdentifierType(bibframeType: string): string {
    const mapping: Record<string, string> = {
      'bf:Isbn': '8261054f-be78-422d-bd51-4ed9f33c3422',
      'bf:Issn': '913300b2-03ed-469a-8179-c1092c991227',
      'bf:Lccn': 'c858e4f2-2b6b-4385-842b-60732ee14abb',
    };
    return mapping[bibframeType] || '7e591197-f335-4afb-bc6d-a6d76ca3bace';
  }

  private mapInstanceType(bibframeType: string | string[]): string {
    const typeStr = Array.isArray(bibframeType) ? bibframeType.join(' ') : String(bibframeType);
    const mapping: Record<string, string> = {
      'bf:Text': '6312d172-f0cf-40f6-b27d-9fa8feaf332f',
      'bf:StillImage': '3363cdb1-e644-446c-82a4-dc3a1d4395b9',
      'bf:MovingImage': '526aa04d-9289-4511-8866-349299592c18',
    };
    for (const [key, uuid] of Object.entries(mapping)) {
      if (typeStr.includes(key)) return uuid;
    }
    return '6312d172-f0cf-40f6-b27d-9fa8feaf332f'; // Default to "text"
  }
}

// Singleton instance
let folioClient: FOLIOApiClient | null = null;

export function initializeFOLIOClient(config: FOLIOConfig): FOLIOApiClient {
  folioClient = new FOLIOApiClient(config);
  return folioClient;
}

export function getFOLIOClient(): FOLIOApiClient {
  if (!folioClient) {
    folioClient = new FOLIOApiClient(DEFAULT_FOLIO_CONFIG);
  }
  return folioClient;
}
