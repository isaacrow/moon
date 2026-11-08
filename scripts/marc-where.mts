// Writes public/marc-where.json, the table behind https://mooon.site/marc.html ("Where is my MARC field?",
// Phase 13 S22), from Moon's own MARC import. Run after changing marcToBibframe; a test checks it is current.
//   npx tsx scripts/marc-where.mts
import { writeFileSync } from 'node:fs';
import { marcWhereTable } from '../src/services/marc/marcWhere';

writeFileSync(new URL('../public/marc-where.json', import.meta.url), JSON.stringify(marcWhereTable()) + '\n');
console.log('public/marc-where.json written');
