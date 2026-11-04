# Moon — BIBFRAME cataloging

Moon is a web cataloging system that produces [BIBFRAME 3.0.1](https://id.loc.gov/ontologies/bibframe.html) records, with full Arabic support (right-to-left editing, Arabic-script and romanized values tagged the way the Library of Congress tags them). It has three parts:

| Part | Where | What it does |
|---|---|---|
| **Moon Studio** | `/moon/` | The cataloging editor. Category Cards (the default layout) or Standard MARC fields, Work / Expression / Instance / Item, LC authority search, ISBN lookup, AI-assisted suggestions, live JSON-LD, Turtle, N-Triples, RDF/XML and MARC 21 views. |
| **OPAC** | `/opac.html` | The public catalog: search, facets (format, subject, author, language...), record pages and BIBFRAME downloads. |
| **Server** | `supabase/functions/server` | A Supabase Edge Function (Deno + Hono): accounts and sessions, record storage, review workflow, authority and discovery services. |

Live site: <https://mooon.site>

## Records are real BIBFRAME

Every export comes from one producer (`src/services/w3cJsonLdBuilder.ts` + `src/services/bibframeNormalizer.ts`), and `npm test` holds it to the official ontology:

- each record is exported as JSON-LD, Turtle, N-Triples and RDF/XML, read back by independent RDF parsers, and all four must hold exactly the same graph;
- only terms defined in BIBFRAME 3.0.1 / BFLC and not deprecated (`ontologies/*.rdf`) are used; local additions go under Moon's own `moonext:` namespace;
- each `bf:` property sits on an entity of its `rdfs:domain` (e.g. `bf:heldBy` on the Item), datatype properties hold text and object properties hold nodes;
- dates are only typed when valid, language tags are BCP 47, and links are real IRIs.

The tests run on the bundled sample records and on records built from what the Category Cards editors actually store.

## Accounts and roles

Catalogers register and are approved by the Super Admin (a valid invite code approves them at once). Catalogers' saves wait in review; the Super Admin approves them into the catalog. A cataloger can change only their own records. The server takes identity from the signed-in session (`X-Moon-Session`), never from the request body. The Supabase anon key in the website is public and grants nothing by itself.

## Development

```bash
npm install
npm run dev          # Vite dev server; open /moon/ for the editor, /opac.html for the catalog
npm test             # serializer, normalizer, ISBN/Arabic and BIBFRAME conformance tests
npm run typecheck    # TypeScript (blocks the deploy)
npm run lint:unused  # unused-code report (does not block)
npm run build        # production build into dist/
```

Other scripts:

- `npm run build:terms`: regenerate `src/services/bibframeTerms.generated.ts` from `ontologies/bibframe.rdf` and `ontologies/bflc.rdf` (terms, domains, class hierarchy, deprecated terms).
- `npm run build:samples`: regenerate the sample records in `public/records/`.
- `npx tsx scripts/audit-category-fields.ts`: list Category Cards fields that are not current BIBFRAME terms of their entity.

The editor can also talk to a local FOLIO (Okapi on :9130), VuFind (:8085) and Solr (:8983) through the dev-server proxy in `vite.config.ts`; `start.bat` / `start-suite.ps1` start that local suite on Windows.

## Deployment

`.github/workflows/deploy.yml` runs on every push to `main`:

1. deploys the edge function as `make-server-49c0e13c` (needs the `SUPABASE_ACCESS_TOKEN` repository secret);
2. runs `npm test` and `npm run typecheck`; a failure stops the deploy;
3. builds and publishes `dist/` to GitHub Pages.

## Layout

```
src/app/            React app: components (WolfMoon.tsx is Moon Studio), contexts, i18n, API clients
src/services/       BIBFRAME producer, normalizer, import, ontology registry, OPAC service
supabase/functions/server/   edge function (index.tsx, accountRoutes.tsx, recordRoutes.tsx, ...)
ontologies/         official LC BIBFRAME and BFLC ontology files
public/records/     sample records in every format
test/               node:test suites (run with tsx)
examples/           more example records
docs/history/       earlier design notes and reports (kept for reference; may describe retired editors)
```
