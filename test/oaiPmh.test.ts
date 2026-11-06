// OAI-PMH 2.0: every verb, paging, date ranges and the protocol's error codes; every reply is well-formed XML.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from '@xmldom/xmldom';
import { oaiResponse, OaiRecord } from '../supabase/functions/server/oaiPmh.tsx';

const OPTS = { baseUrl: 'https://mooon.site/resource', repositoryName: 'Moon', adminEmail: 'catalogue@mooon.site', pageSize: 2 };
const NOW = new Date('2026-11-06T12:00:00Z');
const rec = (id: string, saved: string, title: string): OaiRecord => ({
  id, saved,
  document: { '@graph': [
    { '@id': `https://mooon.site/resource/work/${id}`, '@type': 'bf:Work', 'bf:title': { 'bf:mainTitle': [title, `${title} & co <x>`] },
      'bf:contribution': [{ 'bf:agent': { 'rdfs:label': 'علي الوردي' } }], 'bf:subject': [{ 'rdfs:label': 'Sociology' }],
      'bf:language': { '@id': 'http://id.loc.gov/vocabulary/languages/ara' } },
    { '@type': 'bf:Instance', 'bf:identifiedBy': [{ '@type': 'bf:Isbn', 'rdf:value': '9789953000000' }],
      'bf:provisionActivity': { 'bf:agent': { 'rdfs:label': 'Dar al-Warrak' }, 'bf:date': '2009' } },
  ] },
});
const RECORDS = [rec('a', '2026-11-01T10:00:00.000Z', 'Alpha'), rec('b', '2026-11-02T10:00:00.000Z', 'Beta'), rec('c', '2026-11-03T10:00:00.000Z', 'Gamma')];

const ask = (params: Record<string, string>) => {
  const xml = oaiResponse(params, RECORDS, OPTS, NOW);
  const errors: string[] = [];
  const doc = new DOMParser({ errorHandler: (_l: string, m: string) => errors.push(m) } as any).parseFromString(xml, 'text/xml');
  assert.deepEqual(errors, [], `not well-formed XML:\n${xml}`);
  const text = (tag: string) => Array.from(doc.getElementsByTagName(tag) as any).map((n: any) => n.textContent);
  const errorCode = (doc.getElementsByTagName('error')[0] as any)?.getAttribute('code') ?? null;
  return { xml, text, errorCode };
};

test('Identify describes the repository', () => {
  const r = ask({ verb: 'Identify' });
  assert.deepEqual(r.text('baseURL'), ['https://mooon.site/resource/oai']);
  assert.deepEqual(r.text('protocolVersion'), ['2.0']);
  assert.deepEqual(r.text('earliestDatestamp'), ['2026-11-01T10:00:00Z']);
});

test('ListRecords pages with resumption tokens and gives Dublin Core', () => {
  const p1 = ask({ verb: 'ListRecords', metadataPrefix: 'oai_dc' });
  assert.deepEqual(p1.text('identifier'), ['oai:mooon.site:a', 'oai:mooon.site:b'], 'oldest first, two per page');
  assert.ok(p1.text('dc:identifier').includes('https://mooon.site/resource/work/a'), "the record's own address");
  assert.ok(p1.text('dc:title').includes('Alpha & co <x>'), 'escaped and read back');
  assert.ok(p1.text('dc:creator').includes('علي الوردي'));
  assert.ok(p1.text('dc:identifier').includes('URN:ISBN:9789953000000'));
  assert.deepEqual(p1.text('dc:language').slice(0, 1), ['ara']);
  const token = p1.text('resumptionToken')[0];
  assert.ok(token, 'a second page is announced');
  const p2 = ask({ verb: 'ListRecords', resumptionToken: token });
  assert.deepEqual(p2.text('header').length, 1);
  assert.match(p2.xml, /<resumptionToken completeListSize="3" cursor="2"\/>/, 'the last page has an empty token');
});

test('ListIdentifiers with from / until', () => {
  const r = ask({ verb: 'ListIdentifiers', metadataPrefix: 'oai_dc', from: '2026-11-02', until: '2026-11-02' });
  assert.deepEqual(r.text('identifier'), ['oai:mooon.site:b']);
  assert.equal(ask({ verb: 'ListIdentifiers', metadataPrefix: 'oai_dc', from: '2027-01-01' }).errorCode, 'noRecordsMatch');
});

test('GetRecord and ListMetadataFormats', () => {
  assert.deepEqual(ask({ verb: 'GetRecord', identifier: 'oai:mooon.site:c', metadataPrefix: 'oai_dc' }).text('dc:title').slice(0, 1), ['Gamma']);
  assert.deepEqual(ask({ verb: 'ListMetadataFormats' }).text('metadataPrefix'), ['oai_dc']);
});

test('errors as the protocol defines them', () => {
  assert.equal(ask({}).errorCode, 'badVerb');
  assert.equal(ask({ verb: 'Nope' }).errorCode, 'badVerb');
  assert.equal(ask({ verb: 'ListRecords' }).errorCode, 'badArgument');
  assert.equal(ask({ verb: 'ListRecords', metadataPrefix: 'oai_dc', foo: '1' }).errorCode, 'badArgument');
  assert.equal(ask({ verb: 'ListRecords', metadataPrefix: 'marc21' }).errorCode, 'cannotDisseminateFormat');
  assert.equal(ask({ verb: 'GetRecord', identifier: 'oai:mooon.site:zzz', metadataPrefix: 'oai_dc' }).errorCode, 'idDoesNotExist');
  assert.equal(ask({ verb: 'ListRecords', resumptionToken: 'garbage' }).errorCode, 'badResumptionToken');
  assert.equal(ask({ verb: 'ListRecords', resumptionToken: 'oai_dc|2||', metadataPrefix: 'oai_dc' }).errorCode, 'badArgument');
  assert.equal(ask({ verb: 'ListSets' }).errorCode, 'noSetHierarchy');
  assert.equal(ask({ verb: 'ListRecords', metadataPrefix: 'oai_dc', from: '2026-11-01', until: '2026-11-02T00:00:00Z' }).errorCode, 'badArgument');
});
