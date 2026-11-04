// Lists every Category Cards field that is not a current BIBFRAME/BFLC property of its entity.
import { getPropertiesByDomain } from '../src/services/ontologyRegistry';
import {
  BF_OBJECT_PROPERTIES, BF_DATATYPE_PROPERTIES, BF_PROPERTY_DOMAINS, BF_SUPERCLASSES, BF_DEPRECATED,
  BFLC_OBJECT_PROPERTIES, BFLC_DATATYPE_PROPERTIES, BFLC_DEPRECATED
} from '../src/services/bibframeTerms.generated';

const ancestry = (c: string, s = new Set<string>()): Set<string> => { if (!s.has(c)) { s.add(c); (BF_SUPERCLASSES[c] || []).forEach(x => ancestry(x, s)); } return s; };
for (const entity of ['Work', 'Expression', 'Instance', 'Item']) {
  const cls = entity === 'Expression' ? 'Work' : entity;
  for (const p of getPropertiesByDomain(entity)) {
    const m = p.uri.match(/^http:\/\/id\.loc\.gov\/ontologies\/(bibframe|bflc)\/(\w+)$/);
    if (!m) { console.log(`${entity}\t${p.shortName}\tnot a bf/bflc URI: ${p.uri}`); continue; }
    const [, ns, local] = m;
    const obj = ns === 'bibframe' ? BF_OBJECT_PROPERTIES : BFLC_OBJECT_PROPERTIES;
    const dat = ns === 'bibframe' ? BF_DATATYPE_PROPERTIES : BFLC_DATATYPE_PROPERTIES;
    const dep = ns === 'bibframe' ? BF_DEPRECATED : BFLC_DEPRECATED;
    if (!obj.has(local) && !dat.has(local)) { console.log(`${entity}\t${p.shortName}\tundefined ${ns}:${local}`); continue; }
    if (dep.has(local)) console.log(`${entity}\t${p.shortName}\tdeprecated`);
    const d = ns === 'bibframe' ? BF_PROPERTY_DOMAINS[local] : undefined;
    if (d && !ancestry(cls).has(d)) console.log(`${entity}\t${p.shortName}\tdomain is ${d}`);
    if (dat.has(local) && !['Literal', 'literal', 'Date', 'date', 'string', 'Text', 'text'].some(r => String(p.rangeType).includes(r)))
      console.log(`${entity}\t${p.shortName}\tdatatype property but rangeType=${p.rangeType}`);
    if (obj.has(local) && /^(Literal|literal|string|text|Date)$/.test(String(p.rangeType)))
      console.log(`${entity}\t${p.shortName}\tobject property but rangeType=${p.rangeType}`);
  }
}
