// Writes public/glossary.json (for mooon.site/learn.html) from src/services/glossary.ts. A test checks it is current.
//   npx tsx scripts/glossary-json.mts
import { writeFileSync } from 'node:fs';
import { GLOSSARY } from '../src/services/glossary';

writeFileSync(new URL('../public/glossary.json', import.meta.url), JSON.stringify(GLOSSARY) + '\n');
console.log('public/glossary.json written');
