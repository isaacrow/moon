/**
 * OAI-PMH 2.0 (https://www.openarchives.org/OAI/openarchivesprotocol.html) over Moon's published records,
 * so union catalogues, WorldCat, BASE and other harvesters can collect them. Answers all six verbs with
 * Dublin Core (oai_dc), pages long lists with resumption tokens, and reports errors as the protocol says.
 * A pure function of the records, so it is tested without a database.
 */

export interface OaiRecord { id: string; title?: string; document: any; saved: string }
export interface OaiOptions { baseUrl: string; repositoryName: string; adminEmail: string; earliest?: string; pageSize?: number }

const NS = 'xmlns="http://www.openarchives.org/OAI/2.0/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/ http://www.openarchives.org/OAI/2.0/OAI-PMH.xsd"';
const VERBS = ['Identify', 'ListMetadataFormats', 'ListSets', 'ListIdentifiers', 'ListRecords', 'GetRecord'];
const ARGS: Record<string, { required: string[]; optional: string[]; exclusive?: string }> = {
  Identify: { required: [], optional: [] },
  ListMetadataFormats: { required: [], optional: ['identifier'] },
  ListSets: { required: [], optional: [], exclusive: 'resumptionToken' },
  ListIdentifiers: { required: ['metadataPrefix'], optional: ['from', 'until', 'set'], exclusive: 'resumptionToken' },
  ListRecords: { required: ['metadataPrefix'], optional: ['from', 'until', 'set'], exclusive: 'resumptionToken' },
  GetRecord: { required: ['identifier', 'metadataPrefix'], optional: [] },
};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const all = (v: any): any[] => (v === undefined || v === null || v === '' ? [] : Array.isArray(v) ? v : [v]);
const get = (n: any, p: string) => n?.[`bf:${p}`] ?? n?.[p];
const isA = (n: any, cls: string) => all(n?.['@type']).some((t: any) => String(t) === `bf:${cls}` || String(t) === cls || String(t).endsWith(`/${cls}`));

function texts(v: any): string[] {
  const out: string[] = [];
  for (const x of all(v)) {
    if (typeof x === 'string' || typeof x === 'number') { if (String(x).trim()) out.push(String(x).trim()); continue; }
    if (x && typeof x === 'object') {
      if (x['@value'] !== undefined) { if (String(x['@value']).trim()) out.push(String(x['@value']).trim()); continue; }
      out.push(...texts(x['rdfs:label'] ?? x.label ?? x['bf:mainTitle'] ?? x.mainTitle ?? x['rdf:value'] ?? x.value));
    }
  }
  return [...new Set(out)];
}

/** Dublin Core from a stored Moon record (Work + Instance). */
export function dublinCore(rec: OaiRecord, baseUrl: string): Record<string, string[]> {
  const graph: any[] = Array.isArray(rec.document?.['@graph']) ? rec.document['@graph'] : [];
  const work = graph.find((n) => isA(n, 'Work')) || {};
  const instance = graph.find((n) => isA(n, 'Instance')) || {};
  const provisions = all(get(instance, 'provisionActivity'));
  const lang = all(get(work, 'language')).map((l: any) => String(l?.['@id'] ?? l).split('/').pop()).filter((c) => /^[a-z]{3}$/.test(c));
  const workUri = typeof work['@id'] === 'string' && /^https?:/.test(work['@id']) ? work['@id'] : `${baseUrl}/work/${rec.id}`;
  return {
    title: texts(all(get(work, 'title')).flatMap((t: any) => all(get(t, 'mainTitle') ?? t))).length
      ? texts(all(get(work, 'title')).flatMap((t: any) => all(get(t, 'mainTitle') ?? t))) : texts(rec.title),
    creator: all(get(work, 'contribution')).flatMap((c: any) => texts(get(c, 'agent'))),
    subject: all(get(work, 'subject')).flatMap((s: any) => texts(s)),
    description: all(get(work, 'summary')).flatMap((s: any) => texts(s)),
    publisher: provisions.flatMap((p: any) => all(get(p, 'agent')).flatMap((a: any) => texts(a))),
    date: provisions.flatMap((p: any) => texts(get(p, 'date'))).slice(0, 1),
    type: ['Text'],
    format: texts(get(instance, 'extent')),
    identifier: [workUri, ...all(get(instance, 'identifiedBy')).filter((i: any) => isA(i, 'Isbn')).flatMap((i: any) => texts(i['rdf:value'] ?? i.value)).map((v) => `URN:ISBN:${v}`)],
    language: lang,
  };
}

const oaiId = (base: string, id: string) => `oai:${new URL(base).host}:${id}`;
const dayOf = (iso: string) => new Date(iso).toISOString().replace(/\.\d{3}Z$/, 'Z');

function header(rec: OaiRecord, base: string) {
  return `<header><identifier>${esc(oaiId(base, rec.id))}</identifier><datestamp>${dayOf(rec.saved)}</datestamp></header>`;
}
function metadata(rec: OaiRecord, base: string) {
  const dc = dublinCore(rec, base);
  const els = Object.entries(dc).flatMap(([k, vs]) => vs.map((v) => `<dc:${k}>${esc(v)}</dc:${k}>`)).join('');
  return `<metadata><oai_dc:dc xmlns:oai_dc="http://www.openarchives.org/OAI/2.0/oai_dc/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/oai_dc/ http://www.openarchives.org/OAI/2.0/oai_dc.xsd">${els}</oai_dc:dc></metadata>`;
}

/** A valid OAI-PMH date: YYYY-MM-DD or YYYY-MM-DDThh:mm:ssZ. */
const validDate = (s: string) => /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}Z)?$/.test(s) && !Number.isNaN(Date.parse(s));

export function oaiResponse(params: Record<string, string>, records: OaiRecord[], options: OaiOptions, now = new Date()): string {
  const base = options.baseUrl;
  const pageSize = options.pageSize || 100;
  const verb = params.verb || '';
  const request = (attrs: boolean) => `<request${attrs ? Object.entries(params).map(([k, v]) => ` ${k}="${esc(v)}"`).join('') : ''}>${esc(base)}/oai</request>`;
  const wrap = (body: string, attrs = true) => `<?xml version="1.0" encoding="UTF-8"?>\n<OAI-PMH ${NS}><responseDate>${dayOf(now.toISOString())}</responseDate>${request(attrs)}${body}</OAI-PMH>`;
  const error = (code: string, msg: string) => wrap(`<error code="${code}">${esc(msg)}</error>`, code !== 'badVerb' && code !== 'badArgument');

  if (!VERBS.includes(verb)) return error('badVerb', verb ? `Unknown verb ${verb}` : 'The verb argument is missing');
  const spec = ARGS[verb];
  const given = Object.keys(params).filter((k) => k !== 'verb');
  if (spec.exclusive && params[spec.exclusive] !== undefined) {
    if (given.length > 1) return error('badArgument', `${spec.exclusive} must be the only argument`);
  } else {
    const missing = spec.required.filter((k) => !params[k]);
    const unknown = given.filter((k) => !spec.required.includes(k) && !spec.optional.includes(k));
    if (missing.length || unknown.length) return error('badArgument', missing.length ? `Missing ${missing.join(', ')}` : `Unknown argument ${unknown.join(', ')}`);
  }

  if (verb === 'Identify') {
    const earliest = options.earliest || (records.length ? records.map((r) => r.saved).sort()[0] : now.toISOString());
    return wrap(`<Identify><repositoryName>${esc(options.repositoryName)}</repositoryName><baseURL>${esc(base)}/oai</baseURL><protocolVersion>2.0</protocolVersion><adminEmail>${esc(options.adminEmail)}</adminEmail><earliestDatestamp>${dayOf(earliest)}</earliestDatestamp><deletedRecord>no</deletedRecord><granularity>YYYY-MM-DDThh:mm:ssZ</granularity></Identify>`);
  }
  if (verb === 'ListSets') return error('noSetHierarchy', 'This repository has no sets');
  if (verb === 'ListMetadataFormats') {
    if (params.identifier && !records.some((r) => oaiId(base, r.id) === params.identifier)) return error('idDoesNotExist', 'No such record');
    return wrap('<ListMetadataFormats><metadataFormat><metadataPrefix>oai_dc</metadataPrefix><schema>http://www.openarchives.org/OAI/2.0/oai_dc.xsd</schema><metadataNamespace>http://www.openarchives.org/OAI/2.0/oai_dc/</metadataNamespace></metadataFormat></ListMetadataFormats>');
  }
  if (verb === 'GetRecord') {
    if (params.metadataPrefix !== 'oai_dc') return error('cannotDisseminateFormat', 'Only oai_dc is available');
    const rec = records.find((r) => oaiId(base, r.id) === params.identifier);
    if (!rec) return error('idDoesNotExist', 'No such record');
    return wrap(`<GetRecord><record>${header(rec, base)}${metadata(rec, base)}</record></GetRecord>`);
  }

  // ListIdentifiers / ListRecords, possibly continued with a resumption token: prefix|offset|from|until
  let prefix = params.metadataPrefix, offset = 0, from = params.from || '', until = params.until || '';
  if (params.resumptionToken !== undefined) {
    const parts = params.resumptionToken.split('|');
    if (parts.length !== 4 || !/^\d+$/.test(parts[1])) return error('badResumptionToken', 'The resumption token is not valid');
    [prefix, , from, until] = parts;
    offset = Number(parts[1]);
  }
  if (prefix !== 'oai_dc') return error('cannotDisseminateFormat', 'Only oai_dc is available');
  if (params.set) return error('noSetHierarchy', 'This repository has no sets');
  if ((from && !validDate(from)) || (until && !validDate(until)) || (from && until && from.length !== until.length)) {
    return error('badArgument', 'from and until must be dates of the same granularity');
  }
  const inRange = records
    .filter((r) => !from || r.saved >= (from.length === 10 ? `${from}T00:00:00` : from.replace('Z', '')))
    .filter((r) => !until || r.saved <= (until.length === 10 ? `${until}T23:59:59.999` : until.replace('Z', '.999')))
    .sort((a, b) => a.saved.localeCompare(b.saved) || a.id.localeCompare(b.id));
  if (!inRange.length) return error('noRecordsMatch', 'No records match');
  if (offset >= inRange.length) return error('badResumptionToken', 'The resumption token is past the end of the list');
  const page = inRange.slice(offset, offset + pageSize);
  const next = offset + page.length;
  const token = next < inRange.length
    ? `<resumptionToken completeListSize="${inRange.length}" cursor="${offset}">${esc(`${prefix}|${next}|${from}|${until}`)}</resumptionToken>`
    : params.resumptionToken !== undefined ? `<resumptionToken completeListSize="${inRange.length}" cursor="${offset}"/>` : '';
  const items = page.map((r) => (verb === 'ListIdentifiers' ? header(r, base) : `<record>${header(r, base)}${metadata(r, base)}</record>`)).join('');
  return wrap(`<${verb}>${items}${token}</${verb}>`);
}
