# Moon for AI agents

Moon (https://mooon.site) is a BIBFRAME 3.0.1 catalogue strong in Arabic. Agents reach it through its MCP server, or through the plain linked-data addresses.

## MCP server

- Endpoint: `https://mooon.site/resource/mcp`. It uses Streamable HTTP: JSON-RPC requests sent as POST, with JSON replies.
- Tools:
  - `search_records`, `get_record`, `sparql` and `validate_record` are read-only.
  - `create_draft` saves a draft only. It needs a cataloguer's `X-Moon-Session`.
- The same server is also at `https://gfbagczwhvxxstbfrfhu.supabase.co/functions/v1/make-server-49c0e13c/resource/mcp`. There, send the public key that the website uses, as `Authorization: Bearer <anon key>` (it is in `workers/resource-router/wrangler.toml`).
- Add it to Claude Code: `claude mcp add --transport http moon https://mooon.site/resource/mcp`

## Rules for agents

1. Every write is a draft. A person reviews and publishes it; no tool publishes, edits or deletes.
2. Say where each fact came from: put the sources in `create_draft`'s `note`. The note and the agent's name are kept with the draft.
3. Write Arabic names and titles in Arabic script, with the ALA-LC romanization beside them (`ar-Latn-t-ar-m0-alaloc`).
4. Link names and subjects to Moon, LC, VIAF or Wikidata URIs where you can. Never invent an identifier.
5. Before saving, call `validate_record`; it lists what is required before publishing.

## Other ways in

- Records: `https://mooon.site/resource/instance/<id>.jsonld`, also as `.ttl`, `.nt` and `.rdf`.
- Data dump: `https://mooon.site/resource/dump.jsonld`.
- SPARQL: `https://mooon.site/resource/sparql`.
- Change feed: `https://mooon.site/resource/changes` (ActivityStreams 2.0).
- OAI-PMH: `https://mooon.site/resource/oai`.
- The MARC ↔ BIBFRAME mapping is in `src/services/marc/` (`marcToBibframe.ts`, `bibframeToMarc.ts`). The round trip is checked by `scripts/marc-round-trip.mts`.
