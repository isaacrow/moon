/**
 * ISNI (International Standard Name Identifier, https://isni.org) name search for the editor. ISNI's SRU
 * service only allows calls from its own site, so the edge function asks and returns plain JSON.
 */

export interface IsniName { isni: string; uri: string; label: string; dates?: string; sources: string[] }

export function isniSearchUrl(name: string, max = 10): string {
  const clean = name.replace(/["\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
  const params = new URLSearchParams({
    query: `pica.nw="${clean}"`, operation: "searchRetrieve", recordSchema: "isni-b", maximumRecords: String(Math.min(20, max)),
  });
  return `https://isni.oclc.org/sru/?${params}`;
}

const tag = (xml: string, name: string) => (xml.match(new RegExp(`<${name}>([^<]*)</${name}>`)) || [])[1]?.trim() || "";
const unxml = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

/** One entry per ISNI record: its number and the first name form (surname, forename, dates). */
export function parseIsni(xml: string): IsniName[] {
  const out: IsniName[] = [];
  for (const [, rec] of xml.matchAll(/<responseRecord>([\s\S]*?)<\/responseRecord>/g)) {
    const isni = tag(rec, "isniUnformatted");
    if (!/^\d{15}[\dX]$/.test(isni)) continue;
    const personal = (rec.match(/<personalName>([\s\S]*?)<\/personalName>/) || [])[1];
    const organisation = (rec.match(/<organisationName>([\s\S]*?)<\/organisationName>/) || [])[1];
    const label = personal
      ? [tag(personal, "surname"), tag(personal, "forename")].filter(Boolean).join(", ")
      : organisation ? [tag(organisation, "mainName"), tag(organisation, "subdivisionName")].filter(Boolean).join(". ") : "";
    if (!label) continue;
    const dates = personal ? tag(personal, "marcDate") : "";
    const sources = [...new Set([...rec.matchAll(/<source>([^<]*)<\/source>/g)].map((m) => m[1].trim()).filter(Boolean))];
    out.push({ isni, uri: `https://isni.org/isni/${isni}`, label: unxml(label).normalize("NFC"), ...(dates ? { dates } : {}), sources });
  }
  return out;
}
