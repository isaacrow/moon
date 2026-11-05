// Server v3.1 - enterprise pattern: env-only API key, redeployed with fresh secret
import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { parseJSONLD } from "./rdfParser.tsx";
import ontology from "./ontology.tsx";
import engine from "./engine.tsx";
import { loadExampleData, getExample, getAllExamples, getExampleKeys } from "./examples.tsx";
import * as locAuth from "./locAuthorityService.tsx";
import * as locSparql from "./locSparqlService.tsx";
import * as ontologyEngine from "./bibframeOntologyEngine.tsx";
import * as graphBuilder from "./graphBuilder.tsx";
import * as moonRecords from "./moonRecords.tsx";
import * as authorities from "./authorities.tsx";
import * as tripleStore from "./tripleStore.tsx";
import * as versioning from "./versioning.tsx";
import * as discovery from "./discovery.tsx";
import * as multiTenant from "./multiTenant.tsx";
import { BIBFRAME_SHAPES, getSHACLShapesAsTurtle } from "./shaclShapes.tsx";
import * as authMiddleware from "./authMiddleware.tsx";
import * as dataIsolation from "./dataIsolation.tsx";
import * as shaclValidator from "./shaclValidator.tsx";
import * as authorityMergeIntegrity from "./authorityMergeIntegrity.tsx";
import * as jwtAuth from "./jwtAuth.tsx";
import * as observability from "./observability.tsx";
import * as loadTesting from "./loadTesting.tsx";
import recordRoutes from "./recordRoutes.tsx";
import accountRoutes, { getSession, isAdminSession, SUPER_ADMIN_USERNAME } from "./accountRoutes.tsx";
import * as recordStore from "./recordStore.tsx";
import * as linkedData from "./linkedData.tsx";
import * as aiEngine from "./aiEngine.tsx";
import * as aiRouter from "./aiRouter.tsx";
import * as ld4 from "./ld4Integration.tsx";

const app = new Hono();

// 🚀 BOOT SEQUENCE - Initialize Moon Engine with correct dependency order
let bootComplete = false;

async function bootMoonEngine() {
  console.log('='.repeat(60));
  console.log('🌙 MOON ENGINE BOOT SEQUENCE STARTING');
  console.log('='.repeat(60));
  
  try {
    // 1️⃣ Load Ontology Schema First
    console.log('[BOOT] Step 1: Loading BIBFRAME Ontology Schema...');
    await ontology.loadSchema();
    
    if (!ontology.isInitialized()) {
      throw new Error('Ontology failed to initialize');
    }
    console.log('[BOOT] ✅ Ontology loaded successfully');
    
    // 2️⃣ Initialize Engine with Ontology
    console.log('[BOOT] Step 2: Initializing Moon Engine...');
    await engine.initialize();
    
    if (!engine.isInitialized()) {
      throw new Error('Engine failed to initialize');
    }
    console.log('[BOOT] ✅ Engine initialized successfully');
    
    // 3️⃣ Load Example Data
    console.log('[BOOT] Step 3: Loading example datasets...');
    await loadExampleData();
    console.log('[BOOT] ✅ Example data loaded successfully');
    
    bootComplete = true;
    
    console.log('='.repeat(60));
    console.log('🎉 MOON ENGINE READY - All systems operational');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('='.repeat(60));
    console.error('❌ MOON ENGINE BOOT FAILED');
    console.error('='.repeat(60));
    console.error('Error:', error);
    throw error;
  }
}

// Start boot sequence immediately
bootMoonEngine().catch(err => {
  console.error('Fatal boot error:', err);
  Deno.exit(1);
});

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "X-Moon-Session"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Routes that spend paid API credit (AI providers, ISBNdb) or change stored data need a signed-in
// Moon session; changing the AI provider setup is the Super Admin's. The public key in the website
// is not a credential: anyone can read it from the page.
const API_PREFIX = "/make-server-49c0e13c";
const SESSION_ANY_METHOD = ["/ai/", "/ai-router/", "/isbndb/"];
const SESSION_WRITES = [
  "/favorites", "/moon/authorities/import", "/moon/triplestore/", "/moon/versions/", "/moon/discovery/import",
  "/ld4/", "/import-bibframe-rdf", "/authority/clear-cache",
];
const ADMIN_ONLY = ["/ai-router/config", "/ai-router/reset-circuit/"];
app.use(`${API_PREFIX}/*`, async (c, next) => {
  if (c.req.method === "OPTIONS") return next();
  const path = c.req.path.slice(API_PREFIX.length);
  const write = c.req.method !== "GET";
  if (write && ADMIN_ONLY.some(p => path.startsWith(p))) {
    if (!(await isAdminSession(c))) return c.json({ error: "Super Admin session required" }, 403);
  } else if (SESSION_ANY_METHOD.some(p => path.startsWith(p)) || (write && SESSION_WRITES.some(p => path.startsWith(p)))) {
    if (!(await getSession(c))) return c.json({ error: "Sign in to use this feature" }, 401);
  }
  return next();
});

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

// Health check endpoint
app.get("/make-server-49c0e13c/health", (c) => {
  return c.json({ status: "ok" });
});

// 🌙 Moon Engine Status Endpoint
app.get("/make-server-49c0e13c/engine/status", (c) => {
  if (!bootComplete) {
    return c.json({ 
      status: 'booting',
      message: 'Moon Engine is still initializing...'
    }, 503);
  }
  
  const status = engine.getStatus();
  return c.json({
    status: 'operational',
    bootComplete,
    engine: status,
    ontology: {
      initialized: ontology.isInitialized(),
      version: ontology.getSchema()?.version
    }
  });
});

// 🔍 Get Ontology Schema
app.get("/make-server-49c0e13c/engine/ontology", (c) => {
  if (!bootComplete) {
    return c.json({ error: 'Engine not ready' }, 503);
  }
  
  const schema = ontology.getSchema();
  return c.json(schema);
});

// 📊 Get Class Information
app.get("/make-server-49c0e13c/engine/class/:className", (c) => {
  if (!bootComplete) {
    return c.json({ error: 'Engine not ready' }, 503);
  }
  
  const className = c.req.param('className');
  const classInfo = ontology.getClass(className);
  
  if (!classInfo) {
    return c.json({ error: 'Class not found' }, 404);
  }
  
  return c.json(classInfo);
});

// 🔗 Get Property Information
app.get("/make-server-49c0e13c/engine/property/:propertyName", (c) => {
  if (!bootComplete) {
    return c.json({ error: 'Engine not ready' }, 503);
  }
  
  const propertyName = c.req.param('propertyName');
  const propertyInfo = ontology.getProperty(propertyName);
  
  if (!propertyInfo) {
    return c.json({ error: 'Property not found' }, 404);
  }
  
  return c.json(propertyInfo);
});

// 📝 Process BIBFRAME Entity
app.post("/make-server-49c0e13c/engine/process", async (c) => {
  if (!bootComplete) {
    return c.json({ error: 'Engine not ready' }, 503);
  }
  
  try {
    const entity = await c.req.json();
    const result = await engine.process(entity);
    
    return c.json(result);
  } catch (error) {
    console.error('Process entity error:', error);
    return c.json({ 
      success: false,
      errors: [error instanceof Error ? error.message : String(error)]
    }, 500);
  }
});

// 📚 Get Example Data
app.get("/make-server-49c0e13c/engine/examples", (c) => {
  if (!bootComplete) {
    return c.json({ error: 'Engine not ready' }, 503);
  }
  
  const keys = getExampleKeys();
  return c.json({ 
    examples: keys,
    count: keys.length
  });
});

// 📖 Get Specific Example
app.get("/make-server-49c0e13c/engine/example/:key", (c) => {
  if (!bootComplete) {
    return c.json({ error: 'Engine not ready' }, 503);
  }
  
  const key = c.req.param('key');
  const example = getExample(key);
  
  if (!example) {
    return c.json({ error: 'Example not found' }, 404);
  }
  
  return c.json(example);
});

// ════════════════════���══════════════════════════════════════
// 🔗 LOC LINKED DATA API INTEGRATION
// ═══════════════���═══════════════════════════════════════════

// 🔍 Search LC Name Authority (LCNAF)
app.get("/make-server-49c0e13c/authority/names", async (c) => {
  try {
    const query = c.req.query('q');
    
    if (!query) {
      return c.json({ error: 'Query parameter required' }, 400);
    }
    
    const results = await locAuth.searchNames(query);
    return c.json({ results, count: results.length });
  } catch (error) {
    console.error('LCNAF search error:', error);
    return c.json({ error: 'Search failed', results: [] }, 500);
  }
});

// 📚 Search LC Subject Headings (LCSH)
app.get("/make-server-49c0e13c/authority/subjects", async (c) => {
  try {
    const query = c.req.query('q');
    
    if (!query) {
      return c.json({ error: 'Query parameter required' }, 400);
    }
    
    const results = await locAuth.searchSubjects(query);
    return c.json({ results, count: results.length });
  } catch (error) {
    console.error('LCSH search error:', error);
    return c.json({ error: 'Search failed', results: [] }, 500);
  }
});

// 🎭 Search LC Genre/Form Terms (LCGFT)
app.get("/make-server-49c0e13c/authority/genreforms", async (c) => {
  try {
    const query = c.req.query('q');
    
    if (!query) {
      return c.json({ error: 'Query parameter required' }, 400);
    }
    
    const results = await locAuth.searchGenreForms(query);
    return c.json({ results, count: results.length });
  } catch (error) {
    console.error('LCGFT search error:', error);
    return c.json({ error: 'Search failed', results: [] }, 500);
  }
});

// 📊 Search LC Classification (LCC)
app.get("/make-server-49c0e13c/authority/classification", async (c) => {
  try {
    const query = c.req.query('q');
    
    if (!query) {
      return c.json({ error: 'Query parameter required' }, 400);
    }
    
    const results = await locAuth.searchClassification(query);
    return c.json({ results, count: results.length });
  } catch (error) {
    console.error('LCC search error:', error);
    return c.json({ error: 'Search failed', results: [] }, 500);
  }
});

// 🧠 Smart Authority Lookup (Auto-detect based on property range)
app.get("/make-server-49c0e13c/authority/smart", async (c) => {
  try {
    const query = c.req.query('q');
    const propertyRange = c.req.query('range') || 'bf:Agent';
    
    if (!query) {
      return c.json({ error: 'Query parameter required' }, 400);
    }
    
    const results = await locAuth.smartAuthorityLookup(query, propertyRange);
    return c.json({ results, count: results.length });
  } catch (error) {
    console.error('Smart authority lookup error:', error);
    return c.json({ error: 'Search failed', results: [] }, 500);
  }
});

// 📖 Fetch BIBFRAME Work from LOC
app.get("/make-server-49c0e13c/bibframe/work/:workId", async (c) => {
  try {
    const workId = c.req.param('workId');
    const work = await locAuth.fetchBIBFRAMEWork(workId);
    
    if (!work) {
      return c.json({ error: 'Work not found' }, 404);
    }
    
    return c.json(work);
  } catch (error) {
    console.error('Fetch BIBFRAME work error:', error);
    return c.json({ error: 'Failed to fetch work' }, 500);
  }
});

// 📚 Fetch BIBFRAME Instance from LOC
app.get("/make-server-49c0e13c/bibframe/instance/:instanceId", async (c) => {
  try {
    const instanceId = c.req.param('instanceId');
    const instance = await locAuth.fetchBIBFRAMEInstance(instanceId);
    
    if (!instance) {
      return c.json({ error: 'Instance not found' }, 404);
    }
    
    return c.json(instance);
  } catch (error) {
    console.error('Fetch BIBFRAME instance error:', error);
    return c.json({ error: 'Failed to fetch instance' }, 500);
  }
});

// 🔎 SPARQL Query Endpoint
app.post("/make-server-49c0e13c/sparql/query", async (c) => {
  try {
    const { query } = await c.req.json();
    
    if (!query) {
      return c.json({ error: 'SPARQL query required' }, 400);
    }
    
    const results = await locAuth.runSPARQLQuery(query);
    return c.json(results);
  } catch (error) {
    console.error('SPARQL query error:', error);
    return c.json({ error: 'Query failed' }, 500);
  }
});

// 🔍 Find Related Works (SPARQL)
app.get("/make-server-49c0e13c/sparql/related/:workUri", async (c) => {
  try {
    const workUri = decodeURIComponent(c.req.param('workUri'));
    const results = await locSparql.findRelatedWorks(workUri);
    return c.json({ results, count: results.length });
  } catch (error) {
    console.error('Find related works error:', error);
    return c.json({ error: 'Search failed', results: [] }, 500);
  }
});

// 🔎 Detect Duplicates (SPARQL)
app.get("/make-server-49c0e13c/sparql/duplicates", async (c) => {
  try {
    const title = c.req.query('title');
    const creator = c.req.query('creator');
    
    if (!title) {
      return c.json({ error: 'Title parameter required' }, 400);
    }
    
    const results = await locSparql.detectDuplicates(title, creator);
    return c.json({ results, count: results.length });
  } catch (error) {
    console.error('Duplicate detection error:', error);
    return c.json({ error: 'Search failed', results: [] }, 500);
  }
});

// 📚 Work Clustering (FRBR-style)
app.get("/make-server-49c0e13c/sparql/cluster/:workUri", async (c) => {
  try {
    const workUri = decodeURIComponent(c.req.param('workUri'));
    const results = await locSparql.clusterWorks(workUri);
    return c.json({ results, count: results.length });
  } catch (error) {
    console.error('Work clustering error:', error);
    return c.json({ error: 'Clustering failed', results: [] }, 500);
  }
});

// 🌐 Advanced Discovery Search
app.post("/make-server-49c0e13c/sparql/discover", async (c) => {
  try {
    const params = await c.req.json();
    const results = await locSparql.advancedDiscovery(params);
    return c.json({ results, count: results.length });
  } catch (error) {
    console.error('Advanced discovery error:', error);
    return c.json({ error: 'Discovery failed', results: [] }, 500);
  }
});

// ═══════════════════════════════════════════════════════════
// 🧠 ONTOLOGY ENGINE INTEGRATION
// ═══════════════════════════════════════════════════════════

// 🔗 Get Authority Service for Property
app.get("/make-server-49c0e13c/ontology/authority-service/:propertyUri", (c) => {
  try {
    const propertyUri = decodeURIComponent(c.req.param('propertyUri'));
    const service = ontologyEngine.getAuthorityService(propertyUri);
    return c.json({ propertyUri, service });
  } catch (error) {
    console.error('Get authority service error:', error);
    return c.json({ error: 'Failed to get service' }, 500);
  }
});

// 📋 Get Properties with Authority Mapping
app.get("/make-server-49c0e13c/ontology/properties/:className", (c) => {
  try {
    const className = c.req.param('className');
    const properties = ontologyEngine.getPropertiesWithAuthorities(className);
    return c.json({ className, properties, count: properties.length });
  } catch (error) {
    console.error('Get properties error:', error);
    return c.json({ error: 'Failed to get properties' }, 500);
  }
});

// ✅ Validate BIBFRAME Record
app.post("/make-server-49c0e13c/ontology/validate", async (c) => {
  try {
    const { entity, className } = await c.req.json();
    
    if (!entity || !className) {
      return c.json({ error: 'Entity and className required' }, 400);
    }
    
    const validation = await ontologyEngine.validateBIBFRAMERecord(entity, className);
    return c.json(validation);
  } catch (error) {
    console.error('Validation error:', error);
    return c.json({ error: 'Validation failed' }, 500);
  }
});

// 🔄 Convert Literal to URI
app.post("/make-server-49c0e13c/ontology/literalToUri", async (c) => {
  try {
    const { propertyUri, literalValue } = await c.req.json();
    
    if (!propertyUri || !literalValue) {
      return c.json({ error: 'Property URI and literal value required' }, 400);
    }
    
    const uriRef = await ontologyEngine.convertLiteralToURI(propertyUri, literalValue);
    return c.json({ uriRef });
  } catch (error) {
    console.error('Convert literal error:', error);
    return c.json({ error: 'Conversion failed' }, 500);
  }
});

// 📈 Get Ontology Statistics
app.get("/make-server-49c0e13c/ontology/stats", (c) => {
  try {
    const stats = ontologyEngine.getOntologyStats();
    return c.json(stats);
  } catch (error) {
    console.error('Get stats error:', error);
    return c.json({ error: 'Failed to get stats' }, 500);
  }
});

// ═════════════════════════════════════���═════════════════════
// 🏗️ RDF GRAPH BUILDER
// ═══════════════════════════════════════════════════════════

// 🏗️ Build RDF Graph
app.post("/make-server-49c0e13c/graph/build", async (c) => {
  try {
    const { workData, instanceData, adminData } = await c.req.json();
    
    if (!workData || !instanceData || !adminData) {
      return c.json({ error: 'Work, instance, and admin data required' }, 400);
    }
    
    const graph = graphBuilder.buildRDFGraph(workData, instanceData, adminData);
    return c.json(graph);
  } catch (error) {
    console.error('Build graph error:', error);
    return c.json({ error: 'Graph build failed' }, 500);
  }
});

// ✅ Validate SPARQL Graph
app.post("/make-server-49c0e13c/graph/validate", async (c) => {
  try {
    const graph = await c.req.json();
    const validation = graphBuilder.validateSPARQLGraph(graph);
    return c.json(validation);
  } catch (error) {
    console.error('Validate graph error:', error);
    return c.json({ error: 'Validation failed' }, 500);
  }
});

// 🔄 Convert to Turtle
app.post("/make-server-49c0e13c/graph/to-turtle", async (c) => {
  try {
    const graph = await c.req.json();
    const turtle = graphBuilder.convertToTurtle(graph);
    return c.text(turtle, 200, { 'Content-Type': 'text/turtle' });
  } catch (error) {
    console.error('Convert to turtle error:', error);
    return c.json({ error: 'Conversion failed' }, 500);
  }
});

// 📊 Get Graph Statistics
app.post("/make-server-49c0e13c/graph/stats", async (c) => {
  try {
    const graph = await c.req.json();
    const stats = graphBuilder.getGraphStats(graph);
    return c.json(stats);
  } catch (error) {
    console.error('Get graph stats error:', error);
    return c.json({ error: 'Failed to get stats' }, 500);
  }
});

// 📈 Authority Cache Statistics
app.get("/make-server-49c0e13c/authority/cache-stats", (c) => {
  try {
    const stats = locAuth.getCacheStats();
    return c.json(stats);
  } catch (error) {
    console.error('Get cache stats error:', error);
    return c.json({ error: 'Failed to get stats' }, 500);
  }
});

// 🗑️ Clear Authority Cache
app.post("/make-server-49c0e13c/authority/clear-cache", (c) => {
  try {
    locAuth.clearCache();
    return c.json({ message: 'Cache cleared successfully' });
  } catch (error) {
    console.error('Clear cache error:', error);
    return c.json({ error: 'Failed to clear cache' }, 500);
  }
});

// ═══════════════════════════════════════════════════════════
// 💾 GRAPH RECORD STORAGE (JSON-LD Persistence)
// ═══════════════════════════════════════════════════════════

// 💾 Save BIBFRAME Record (full JSON-LD document)
app.post("/make-server-49c0e13c/records/save", async (c) => {
  try {
    // Only signed-in, approved catalogers save; the record says who saved it from the session, not the request.
    const session = await getSession(c);
    if (!session) {
      return c.json({ error: 'Sign in to save records' }, 401);
    }

    // baseVersion: the version the editor started from. A record saved by someone else meanwhile is not
    // overwritten: the reply is 409 with who saved which version, and the editor lets the cataloger choose.
    const { id, document, title, metadata, status: requestedStatus, baseVersion } = await c.req.json();

    if (!id || !document) {
      return c.json({ error: 'Record ID and document required' }, 400);
    }
    // The id becomes part of a storage key: letters, digits and . _ : - only.
    if (typeof id !== 'string' || !/^[A-Za-z0-9._:-]{1,120}$/.test(id)) {
      return c.json({ error: 'Invalid record ID' }, 400);
    }

    // Validate it's a proper JSON-LD document describing a Work and an Instance
    if (!document['@graph'] || !Array.isArray(document['@graph'])) {
      return c.json({ error: 'Invalid JSON-LD document: @graph array required' }, 400);
    }
    const graph: any[] = document['@graph'];
    if (graph.length > 500 || JSON.stringify(document).length > 2_000_000) {
      return c.json({ error: 'Record is too large' }, 413);
    }
    const typed = (suffix: string) => graph.some((n: any) =>
      ([] as any[]).concat(n?.['@type'] || []).some((t: any) => typeof t === 'string' && t.endsWith(suffix)));
    if (!typed('Work') || !typed('Instance')) {
      return c.json({ error: 'A BIBFRAME record needs a bf:Work and a bf:Instance' }, 400);
    }

    // Review workflow: only the Super Admin can publish straight to the catalog.
    // Everyone else's saves (new records and edits) wait for approval.
    const isAdmin = session.role === 'admin';
    const status = isAdmin
      ? (requestedStatus === 'pending-review' ? 'pending-review' : 'complete')
      : 'pending-review';

    const existing = await recordStore.getRecord(id);
    // A cataloger edits their own records; anyone else's are the Super Admin's to change.
    if (existing && !isAdmin && existing.cataloger && existing.cataloger !== session.username) {
      return c.json({ error: 'This record belongs to another cataloger' }, 403);
    }
    const now = new Date().toISOString();
    const cataloger = isAdmin && existing?.cataloger ? existing.cataloger : session.username;

    // Each save is a new version of the record.
    let version: number;
    try {
      version = await recordStore.saveRecord({
        id,
        title: title || existing?.title || 'Untitled',
        document,
        metadata: { ...(existing?.metadata || {}), ...(metadata || {}), status },
        status,
        cataloger,
        createdAt: existing?.createdAt || existing?.saved || now,
        ...(status === 'complete'
          ? { approvedBy: isAdmin ? session!.username : existing?.approvedBy, approvedAt: now }
          : {}),
        saved: now,
      }, session.username, 'save', Number.isInteger(baseVersion) ? baseVersion : undefined);
    } catch (error) {
      if (!(error instanceof recordStore.VersionConflictError)) throw error;
      const [latest] = await recordStore.listVersions(id);
      return c.json({
        error: 'This record was saved by someone else while you were editing it',
        conflict: {
          currentVersion: error.currentVersion,
          savedBy: latest?.version === error.currentVersion ? latest.savedBy : undefined,
          savedAt: latest?.version === error.currentVersion ? latest.savedAt : undefined,
        },
      }, 409);
    }

    console.log(`[RECORDS] Saved record ${id} v${version} "${title || 'Untitled'}" (${status}) by ${cataloger} with ${document['@graph'].length} nodes`);
    // The Super Admin hears about every save that now waits for their review.
    if (status === 'pending-review') {
      await recordStore.notify(SUPER_ADMIN_USERNAME, 'review', { id, title: title || existing?.title || 'Untitled' }, session.username);
    }

    return c.json({
      success: true,
      id,
      title: title || 'Untitled',
      status,
      cataloger,
      version,
      // A cataloger's edit of a published record leaves the published version live until approval.
      publishedVersion: status === 'complete' ? version : existing?.publishedVersion,
      nodeCount: document['@graph'].length,
      saved: now,
    });
  } catch (error) {
    console.error('Save record error:', error);
    return c.json({ error: 'Failed to save record' }, 500);
  }
});

// 🌐 Resolvable URIs: https://mooon.site/resource/<kind>/<id> reaches here through the Cloudflare
// Worker in workers/resource-router. The published record describing that URI is answered as
// JSON-LD, Turtle or N-Triples (by extension, e.g. .ttl, or by the Accept header); a browser is sent
// (303 See Other) to the record's page in the OPAC. Only published versions are ever served.
// 📚 https://mooon.site/resource/ itself: a page listing every published record with its Work and Instance
// addresses and data formats (JSON with ?format=json or Accept: application/json).
async function resourceIndex(c: any) {
  try {
    const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
    const nodeId = (doc: any, cls: string) => (Array.isArray(doc?.['@graph']) ? doc['@graph'] : [])
      .find((n: any) => [].concat(n?.['@type'] ?? []).some((t: any) => String(t).endsWith(cls)) && String(n?.['@id'] || '').startsWith(linkedData.BASE_URI))?.['@id'];
    const records = (await recordStore.listPublishedRecords())
      .map((r) => ({ id: r.id, title: r.title, work: nodeId(r.document, 'Work'), instance: nodeId(r.document, 'Instance'), saved: r.saved }))
      .filter((r) => r.work)
      .sort((a, b) => String(a.title).localeCompare(String(b.title)));
    const wantsJson = c.req.query('format') === 'json' || /application\/json/.test(c.req.header('Accept') || '');
    if (wantsJson) return c.json({ count: records.length, records }, 200, { 'Access-Control-Allow-Origin': '*' });
    const rows = records.map((r) => `<li><a class="t" href="${esc(r.work)}" dir="auto">${esc(r.title)}</a>
      <div class="u"><a href="${esc(r.work)}">${esc(r.work)}</a>${r.instance ? `<br><a href="${esc(r.instance)}">${esc(r.instance)}</a>` : ''}</div>
      <div class="f"><a href="${esc(r.work)}.jsonld">JSON-LD</a> · <a href="${esc(r.work)}.ttl">Turtle</a> · <a href="${esc(r.work)}.nt">N-Triples</a></div></li>`).join('\n');
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Moon — published records</title><style>
body{font-family:system-ui,"Segoe UI",Tahoma,sans-serif;max-width:860px;margin:0 auto;padding:24px 16px;background:#0b1020;color:#e5e7eb}
h1{font-size:1.5rem;margin:0 0 4px}p{color:#9ca3af;margin:0 0 20px}ul{list-style:none;padding:0;margin:0}
li{padding:14px 0;border-top:1px solid #1f2937}a{color:#93c5fd;text-decoration:none}a:hover{text-decoration:underline}
.t{font-weight:600;font-size:1.05rem;color:#f9fafb}.u{font-family:ui-monospace,monospace;font-size:.8rem;margin-top:4px;word-break:break-all}.f{font-size:.8rem;margin-top:4px;color:#9ca3af}
</style></head><body><h1>Moon — published records</h1>
<p>${records.length} BIBFRAME records. Each address opens the record's page in a browser, or its data for library systems (JSON-LD, Turtle, N-Triples). <a href="?format=json">This list as JSON</a> · <a href="/opac.html">Catalogue</a></p>
<ul>${rows}</ul></body></html>`;
    return c.html(html, 200, { 'Cache-Control': 'public, max-age=300' });
  } catch (error) {
    console.error('Resource index error:', error);
    return c.json({ error: 'Failed to list records' }, 500);
  }
}
app.get("/make-server-49c0e13c/resource", resourceIndex);
app.get("/make-server-49c0e13c/resource/", resourceIndex);

app.get("/make-server-49c0e13c/resource/:kind/:id", async (c) => {
  const kind = c.req.param('kind');
  const { id, format: fromExtension } = linkedData.splitExtension(c.req.param('id'));
  if (!/^[a-z]+$/.test(kind) || !/^[A-Za-z0-9._:-]{1,120}$/.test(id)) {
    return c.json({ error: 'Not a Moon resource URI' }, 404);
  }
  const uri = `${linkedData.BASE_URI}/${kind}/${id}`;
  const format = fromExtension ?? linkedData.negotiate(c.req.header('Accept'));
  try {
    const record = await recordStore.findPublishedByUri(uri);
    if (!record) {
      return c.json({ error: 'No published record has this URI', uri }, 404);
    }
    const alternates = (['jsonld', 'ttl', 'nt'] as const)
      .map((f) => `<${uri}.${f}>; rel="alternate"; type="${linkedData.MEDIA_TYPES[f]}"`)
      .join(', ');
    const headers: Record<string, string> = {
      Vary: 'Accept',
      Link: alternates,
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
    };
    if (format === 'html') {
      const page = new URL('/opac.html', linkedData.BASE_URI);
      page.searchParams.set('work', record.id);
      return c.body(null, 303, { ...headers, Location: page.toString() });
    }
    if (format === 'jsonld') {
      return c.body(JSON.stringify(linkedData.toJsonLd(record.document), null, 2), 200, { ...headers, 'Content-Type': `${linkedData.MEDIA_TYPES.jsonld}; charset=utf-8` });
    }
    const body = format === 'ttl' ? await linkedData.toTurtle(record.document) : await linkedData.toNTriples(record.document);
    return c.body(body, 200, { ...headers, 'Content-Type': `${linkedData.MEDIA_TYPES[format]}; charset=utf-8` });
  } catch (error) {
    console.error('Resolve URI error:', uri, error);
    return c.json({ error: 'Failed to resolve the URI' }, 500);
  }
});

// 🔎 Search records on the server: ?q=words&status=&cataloger=&language=&template=&limit=&offset=
// Every word must match, however it is spelled (Arabic letter variants and diacritics are folded).
// Same visibility rule as the list: the public and ?view=published search published versions only.
// Registered before /records/:id so "search" is not read as a record id.
app.get("/make-server-49c0e13c/records/search", async (c) => {
  try {
    const published = c.req.query('view') === 'published' || !(await getSession(c));
    const num = (v: string | undefined, d: number) => (v && /^\d+$/.test(v) ? Number(v) : d);
    const result = await recordStore.searchRecords({
      query: (c.req.query('q') || '').slice(0, 200),
      published,
      // A status filter only makes sense on working copies; published results are all 'complete'.
      status: published ? undefined : c.req.query('status'),
      cataloger: c.req.query('cataloger'),
      language: c.req.query('language'),
      template: c.req.query('template'),
      limit: Math.min(num(c.req.query('limit'), 50), 200),
      offset: num(c.req.query('offset'), 0),
    });
    return c.json({
      ...result,
      records: result.records.map((r) => ({ ...r, nodeCount: r.document?.['@graph']?.length || 0 })),
    });
  } catch (error) {
    console.error('Search records error:', error);
    return c.json({ error: 'Search failed' }, 500);
  }
});

// 📖 Load BIBFRAME Record
app.get("/make-server-49c0e13c/records/:id", async (c) => {
  try {
    const id = c.req.param('id');
    // The public, and anyone asking with ?view=published (the OPAC), get the published version: an edit
    // waiting for review never replaces what the catalogue shows. Signed-in catalogers get the working copy.
    const published = c.req.query('view') === 'published' || !(await getSession(c));
    const record = published ? await recordStore.getPublishedRecord(id) : await recordStore.getRecord(id);

    if (!record) {
      return c.json({ error: 'Record not found' }, 404);
    }
    console.log(`[RECORDS] Loaded record ${id}${published ? ' (published)' : ''}`);
    
    return c.json(record);
  } catch (error) {
    console.error('Load record error:', error);
    return c.json({ error: 'Failed to load record' }, 500);
  }
});

// 📋 List All Records
app.get("/make-server-49c0e13c/records", async (c) => {
  try {
    // Same rule as a single record: the public and ?view=published get published versions only.
    const published = c.req.query('view') === 'published' || !(await getSession(c));
    const records = published ? await recordStore.listPublishedRecords() : await recordStore.listRecords();

    const recordList = records
      .map((record) => ({
        id: record.id,
        title: record.title || 'Untitled',
        document: record.document,
        metadata: record.metadata,
        status: record.status,
        cataloger: record.cataloger,
        approvedBy: record.approvedBy,
        approvedAt: record.approvedAt,
        createdAt: record.createdAt || record.saved,
        saved: record.saved,
        version: record.version,
        publishedVersion: record.publishedVersion,
        nodeCount: record.document?.['@graph']?.length || 0,
      }));

    // Sort by saved date, newest first
    recordList.sort((a: any, b: any) => new Date(b.saved).getTime() - new Date(a.saved).getTime());
    
    console.log(`[RECORDS] Listed ${recordList.length} records`);
    
    return c.json({ records: recordList, count: recordList.length });
  } catch (error) {
    console.error('List records error:', error);
    return c.json({ error: 'Failed to list records' }, 500);
  }
});

// ✅ Approve / reject a pending record (Super Admin only)
async function reviewRecord(c: any, decision: 'complete' | 'needs-review') {
  try {
    const admin = await isAdminSession(c);
    if (!admin) {
      return c.json({ success: false, error: 'Super Admin session required' }, 403);
    }
    const id = c.req.param('id');
    // A return can say what to fix: { "reason": "..." }, shown to the cataloger in their notification.
    const { reason } = await c.req.json().catch(() => ({}));
    const record = await recordStore.reviewRecord(id, decision, admin.username);
    if (!record) {
      return c.json({ success: false, error: 'Record not found' }, 404);
    }
    console.log(`[RECORDS] ${admin.username} set record ${id} -> ${decision} (v${record.version})`);
    if (record.cataloger && record.cataloger !== admin.username) {
      await recordStore.notify(record.cataloger, decision === 'complete' ? 'approved' : 'returned', record, admin.username,
        typeof reason === 'string' ? reason.slice(0, 1000) : undefined);
    }
    return c.json({
      success: true,
      id,
      status: decision,
      version: record.version,
      approvedBy: record.approvedBy,
      approvedAt: record.approvedAt,
    });
  } catch (error) {
    console.error('Review record error:', error);
    return c.json({ success: false, error: 'Failed to update record status' }, 500);
  }
}

app.post("/make-server-49c0e13c/records/:id/approve", (c) => reviewRecord(c, 'complete'));
app.post("/make-server-49c0e13c/records/:id/reject", (c) => reviewRecord(c, 'needs-review'));

// 🔔 Notifications for the signed-in user: newest 30 and the unread count (a new user's welcome is
// created on their first look). POST .../read marks { ids } read, or all of them without ids.
app.get("/make-server-49c0e13c/notifications", async (c) => {
  try {
    const session = await getSession(c);
    if (!session) return c.json({ error: 'Sign in to see notifications' }, 401);
    return c.json(await recordStore.listNotifications(session.username));
  } catch (error) {
    console.error('Notifications error:', error);
    return c.json({ error: 'Failed to load notifications' }, 500);
  }
});

app.post("/make-server-49c0e13c/notifications/read", async (c) => {
  try {
    const session = await getSession(c);
    if (!session) return c.json({ error: 'Sign in to see notifications' }, 401);
    const { ids } = await c.req.json().catch(() => ({}));
    const valid = Array.isArray(ids) ? ids.filter((i: unknown) => Number.isInteger(i)).slice(0, 200) : undefined;
    return c.json({ marked: await recordStore.markNotificationsRead(session.username, valid) });
  } catch (error) {
    console.error('Mark notifications read error:', error);
    return c.json({ error: 'Failed to update notifications' }, 500);
  }
});

// ✏️ Who is editing: the editor calls this every half minute while a record is open, and gets back the
// other catalogers active on it, so it can warn "<username> is working on this record".
app.post("/make-server-49c0e13c/records/:id/editing", async (c) => {
  try {
    const session = await getSession(c);
    if (!session) {
      return c.json({ error: 'Sign in to edit records' }, 401);
    }
    const editors = await recordStore.editingHeartbeat(c.req.param('id'), session.username);
    return c.json({ editors });
  } catch (error) {
    console.error('Editing heartbeat error:', error);
    return c.json({ error: 'Failed to update who is editing' }, 500);
  }
});

app.delete("/make-server-49c0e13c/records/:id/editing", async (c) => {
  try {
    const session = await getSession(c);
    if (!session) {
      return c.json({ error: 'Sign in to edit records' }, 401);
    }
    await recordStore.editingLeave(c.req.param('id'), session.username);
    return c.json({ success: true });
  } catch (error) {
    console.error('Editing leave error:', error);
    return c.json({ error: 'Failed to update who is editing' }, 500);
  }
});

// 🕓 Version history: every save, approval, return and revert of a record (signed-in catalogers only,
// since earlier versions can include unpublished states).
app.get("/make-server-49c0e13c/records/:id/versions", async (c) => {
  try {
    if (!(await getSession(c))) {
      return c.json({ error: 'Sign in to see a record\'s history' }, 401);
    }
    const id = c.req.param('id');
    const record = await recordStore.getRecord(id);
    if (!record) {
      return c.json({ error: 'Record not found' }, 404);
    }
    const versions = await recordStore.listVersions(id);
    return c.json({ id, current: record.version ?? null, published: record.publishedVersion ?? null, versions });
  } catch (error) {
    console.error('List versions error:', error);
    return c.json({ error: 'Failed to load the record\'s history' }, 500);
  }
});

app.get("/make-server-49c0e13c/records/:id/versions/:version", async (c) => {
  try {
    if (!(await getSession(c))) {
      return c.json({ error: 'Sign in to see a record\'s history' }, 401);
    }
    const version = Number(c.req.param('version'));
    if (!Number.isInteger(version) || version < 1) {
      return c.json({ error: 'Invalid version' }, 400);
    }
    const found = await recordStore.getVersion(c.req.param('id'), version);
    return found ? c.json(found) : c.json({ error: 'Version not found' }, 404);
  } catch (error) {
    console.error('Load version error:', error);
    return c.json({ error: 'Failed to load the version' }, 500);
  }
});

// ↩️ Revert: an earlier version becomes current again, saved as a new version. The same people who may
// save the record may revert it, and the same review rule applies: a cataloger's revert waits for approval.
app.post("/make-server-49c0e13c/records/:id/revert", async (c) => {
  try {
    const session = await getSession(c);
    if (!session) {
      return c.json({ error: 'Sign in to revert records' }, 401);
    }
    const id = c.req.param('id');
    const { version } = await c.req.json().catch(() => ({}));
    if (!Number.isInteger(version) || version < 1) {
      return c.json({ error: 'Version number required' }, 400);
    }
    const current = await recordStore.getRecord(id);
    if (!current) {
      return c.json({ error: 'Record not found' }, 404);
    }
    const isAdmin = session.role === 'admin';
    if (!isAdmin && current.cataloger && current.cataloger !== session.username) {
      return c.json({ error: 'This record belongs to another cataloger' }, 403);
    }
    if (version === current.version) {
      return c.json({ error: 'That version is already the current one' }, 400);
    }
    const target = await recordStore.getVersion(id, version);
    if (!target) {
      return c.json({ error: 'Version not found' }, 404);
    }
    const status = isAdmin ? 'complete' : 'pending-review';
    const newVersion = await recordStore.revertRecord(current, target, session.username, status);
    console.log(`[RECORDS] ${session.username} reverted record ${id} to v${version} as v${newVersion}`);
    if (status === 'pending-review') {
      await recordStore.notify(SUPER_ADMIN_USERNAME, 'review', { id, title: target.title }, session.username);
    }
    return c.json({ success: true, id, version: newVersion, revertedTo: version, status });
  } catch (error) {
    console.error('Revert record error:', error);
    return c.json({ error: 'Failed to revert the record' }, 500);
  }
});

// 🗑️ Delete Record
app.delete("/make-server-49c0e13c/records/:id", async (c) => {
  try {
    const id = c.req.param('id');

    // Only the Super Admin or the record's own cataloger may delete it.
    const session = await getSession(c);
    if (!session) {
      return c.json({ error: 'Please sign in to delete records' }, 401);
    }
    const existing = await recordStore.getRecord(id);
    if (existing && session.role !== 'admin') {
      const owner = String(existing.cataloger || '').toLowerCase();
      if (owner !== session.username.toLowerCase()) {
        return c.json({ error: 'Only the Super Admin or the record\'s cataloger can delete it' }, 403);
      }
    }

    await recordStore.deleteRecord(id);
    console.log(`[RECORDS] ${session.username} deleted record ${id}`);
    
    return c.json({ success: true, id });
  } catch (error) {
    console.error('Delete record error:', error);
    return c.json({ error: 'Failed to delete record' }, 500);
  }
});

// ═══════════════════════════════════════════════════════════
// 🌙 MOON ENGINE RECORDS (Separate Storage for Moon Engine)
// ══════════════════════════════��════════════════════════════


// 📋 List Moon Engine Records
app.get("/make-server-49c0e13c/moon-engine/records", async (c) => {
  try {
    const records = await kv.getByPrefix('moon-engine:record:');
    
    const recordList = records.map((r: string) => {
      const record = JSON.parse(r);
      return {
        id: record.id,
        title: record.title,
        saved: record.saved,
        nodeCount: record.document?.['@graph']?.length || 0,
        document: record.document
      };
    });
    
    // Sort by saved date, newest first
    recordList.sort((a, b) => new Date(b.saved).getTime() - new Date(a.saved).getTime());
    
    console.log(`[MOON ENGINE] Listed ${recordList.length} records`);
    
    return c.json({ records: recordList, count: recordList.length });
  } catch (error) {
    console.error('Moon Engine list error:', error);
    return c.json({ error: 'Failed to list Moon Engine records' }, 500);
  }
});

// 📖 Load Single Moon Engine Record
app.get("/make-server-49c0e13c/moon-engine/records/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const recordKey = `moon-engine:record:${id}`;
    
    const recordData = await kv.get(recordKey);
    if (!recordData) {
      return c.json({ error: 'Record not found' }, 404);
    }
    
    const record = JSON.parse(recordData);
    console.log(`[MOON ENGINE] Loaded record ${id}`);
    
    return c.json(record);
  } catch (error) {
    console.error('Moon Engine load error:', error);
    return c.json({ error: 'Failed to load Moon Engine record' }, 500);
  }
});


// ═══════════════════════════════════════════════════════════
// 🌐 VIAF PROXY (CORS Workaround)
// ═══════════════════════════════════════════════════════════

// 🔍 VIAF AutoSuggest Search
app.get("/make-server-49c0e13c/viaf/search", async (c) => {
  try {
    const query = c.req.query('q');
    
    if (!query || query.trim().length === 0) {
      return c.json({ results: [] });
    }
    
    const url = `https://viaf.org/viaf/AutoSuggest?query=${encodeURIComponent(query)}`;
    console.log('[VIAF Proxy] Searching:', query);
    
    const response = await fetch(url, { 
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000)
    });
    
    if (!response.ok) {
      console.log(`[VIAF Proxy] ⚠️ VIAF search returned ${response.status} for query: ${query}`);
      // Return empty results instead of error for search failures
      return c.json({ results: [], count: 0, warning: `VIAF returned ${response.status}` });
    }
    
    const data = await response.json();
    const results = data?.result || [];
    
    const formattedResults = results.map((item: any, index: number) => ({
      source: 'VIAF',
      id: item.viafid || item.recordID || '',
      label: item.term || item.displayForm || '',
      description: buildViafDescription(item),
      uri: `https://viaf.org/viaf/${item.viafid || item.recordID}`,
      score: 1.0 - (index * 0.05)
    }));
    
    console.log(`[VIAF Proxy] ✅ Found ${formattedResults.length} results`);
    return c.json({ results: formattedResults, count: formattedResults.length });
    
  } catch (error) {
    console.error('[VIAF Proxy] ❌ Error:', error);
    // Return empty results gracefully instead of throwing
    return c.json({ results: [], count: 0, warning: error instanceof Error ? error.message : String(error) });
  }
});

// 📖 VIAF Person Details
app.get("/make-server-49c0e13c/viaf/details/:viafId", async (c) => {
  try {
    const viafId = c.req.param('viafId');
    const url = `https://viaf.org/viaf/${viafId}/viaf.json`;
    
    console.log('[VIAF Proxy] Fetching details:', viafId);
    
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000)
    });
    
    if (!response.ok) {
      console.log(`[VIAF Proxy] ⚠️ VIAF returned ${response.status} for ${viafId}`);
      
      // Return appropriate status code based on VIAF response
      if (response.status === 404) {
        return c.json({ error: 'VIAF record not found', viafId }, 404);
      }
      
      return c.json({ error: `VIAF returned ${response.status}`, viafId }, response.status);
    }
    
    const data = await response.json();
    console.log('[VIAF Proxy] ✅ Details fetched');
    
    return c.json(data);
    
  } catch (error) {
    console.error('[VIAF Proxy] ❌ Error:', error);
    return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

// Helper function for VIAF description
function buildViafDescription(item: any): string {
  const parts: string[] = [];
  if (item.birthDate) parts.push(`b. ${item.birthDate}`);
  if (item.deathDate) parts.push(`d. ${item.deathDate}`);
  if (item.nametype) parts.push(item.nametype);
  return parts.join(', ');
}



// BIBFRAME Search - searches id.loc.gov using the official API format
app.get("/make-server-49c0e13c/search-bibframe", async (c) => {
  try {
    const query = c.req.query('q');
    
    if (!query) {
      return c.json({ error: 'Query parameter required' }, 400);
    }

    // Search LOC BIBFRAME Works using the official API format
    // https://id.loc.gov/search/?q=<search_term>&q=cs:http://id.loc.gov/resources/works&format=json
    const searchUrl = `https://id.loc.gov/search/?q=${encodeURIComponent(query)}&q=cs:http://id.loc.gov/resources/works&format=json`;
    
    console.log('Searching LOC BIBFRAME:', searchUrl);
    
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'Accept': 'application/json',
      }
    });
    
    if (!searchResponse.ok) {
      console.error('LOC search failed:', searchResponse.status, searchResponse.statusText);
      throw new Error('LOC search failed');
    }

    const searchData = await searchResponse.json();
    console.log(`Found ${searchData.length} results from LOC`);
    
    const results = [];

    // Process search results according to LOC API response format
    // Each hit has: atom:link, aLabel, title, uri, token, hits
    for (const hit of searchData.slice(0, 20)) {
      try {
        const uri = hit.uri;
        
        // Skip records without a valid URI
        if (!uri) {
          console.log('Skipping record without URI:', hit.title || 'Untitled');
          continue;
        }
        
        const title = hit.title || 'Untitled';
        const aLabel = hit.aLabel || ''; // Contains "Title / Author" format
        
        // Extract author from aLabel (format: "Title / Author")
        const authors: string[] = [];
        if (aLabel) {
          const parts = aLabel.split(' / ');
          if (parts.length > 1) {
            authors.push(parts[1].trim());
          }
        }
        
        // Try to fetch detailed metadata to get ISBN for cover image
        let isbn = undefined;
        let cover = undefined;
        let resourceType = undefined;
        let publicationDate = undefined;
        
        try {
          // Fetch details with valid URI
          
          // Fetch the work's instance to get ISBN
          const detailResponse = await fetch(`${uri}.json`, {
            headers: { 'Accept': 'application/json' }
          });
          
          if (detailResponse.ok) {
            const detailData = await detailResponse.json();
            const workData = detailData[uri];
            
            // Get work type
            if (workData?.['@type']) {
              const types = Array.isArray(workData['@type']) ? workData['@type'] : [workData['@type']];
              for (const type of types) {
                if (typeof type === 'string' && type.includes('bibframe')) {
                  resourceType = type.replace('http://id.loc.gov/ontologies/bibframe/', 'bf:');
                  break;
                }
              }
            }
            
            // Try to find instances to get ISBN
            const instances = workData?.['http://id.loc.gov/ontologies/bibframe/hasInstance'] || [];
            for (const instance of instances) {
              const instanceUri = typeof instance === 'string' ? instance : instance['@id'];
              if (instanceUri) {
                try {
                  const instanceResponse = await fetch(`${instanceUri}.json`);
                  if (instanceResponse.ok) {
                    const instanceData = await instanceResponse.json();
                    const instanceResource = instanceData[instanceUri];
                    
                    // Extract ISBN
                    const identifiers = instanceResource?.['http://id.loc.gov/ontologies/bibframe/identifiedBy'] || [];
                    for (const id of identifiers) {
                      const idUri = typeof id === 'string' ? id : id['@id'];
                      if (idUri) {
                        const idData = instanceData[idUri];
                        const types = idData?.['@type'] || [];
                        if (types.includes('http://id.loc.gov/ontologies/bibframe/Isbn')) {
                          const values = idData['http://www.w3.org/1999/02/22-rdf-syntax-ns#value'] || [];
                          if (values.length > 0) {
                            isbn = values[0]['@value'];
                            break;
                          }
                        }
                      }
                    }
                    
                    if (isbn) break;
                  }
                } catch (err) {
                  // Continue to next instance
                  continue;
                }
              }
            }
            
            // Extract publication date
            const originDate = workData?.['http://id.loc.gov/ontologies/bibframe/originDate'];
            if (originDate && originDate.length > 0) {
              publicationDate = originDate[0]['@value'];
            }
          }
        } catch (err) {
          console.log(`Error fetching details for ${uri}:`, err instanceof Error ? err.message : String(err));
          // Continue with basic information even if detail fetch fails
        }
        
        // Get cover from Open Library if ISBN exists
        if (isbn) {
          cover = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
        }

        results.push({
          title,
          authors,
          isbn,
          cover,
          bibframe_uri: uri,
          type: resourceType,
          date: publicationDate,
        });
      } catch (err) {
        console.error('Error processing search result:', err);
        continue;
      }
    }

    console.log(`Processed ${results.length} results successfully`);
    return c.json({ results });
  } catch (error) {
    console.error('BIBFRAME search error:', error);
    return c.json({ error: 'Search failed', results: [] }, 500);
  }
});

// Load BIBFRAME resource details - comprehensive parser
app.get("/make-server-49c0e13c/load-bibframe", async (c) => {
  try {
    const uri = c.req.query('uri');
    
    if (!uri) {
      return c.json({ error: 'URI parameter required' }, 400);
    }

    console.log('Loading BIBFRAME resource:', uri);

    // Fetch JSON-LD representation
    const response = await fetch(`${uri}.json`, {
      headers: {
        'Accept': 'application/json',
      }
    });
    
    if (!response.ok) {
      console.error('Failed to fetch resource:', response.status, response.statusText);
      throw new Error('Failed to fetch resource');
    }

    const jsonLdData = await response.json();
    console.log('Fetched JSON-LD data for', uri);
    
    // Parse JSON-LD into Moon BIBFRAME structure
    const record = parseJSONLD(jsonLdData, uri);
    
    console.log('Successfully parsed BIBFRAME record');
    return c.json(record);
  } catch (error) {
    console.error('Load BIBFRAME error:', error);
    return c.json({ error: 'Failed to load resource' }, 500);
  }
});

// Parse JSON-LD endpoint for file imports
app.post("/make-server-49c0e13c/parse-jsonld", async (c) => {
  try {
    const { jsonld } = await c.req.json();
    
    if (!jsonld) {
      return c.json({ error: 'jsonld parameter required' }, 400);
    }

    console.log('Parsing JSON-LD from file upload');
    
    // Extract work URI from the data
    let workUri = '';
    
    if (Array.isArray(jsonld)) {
      // Find Work in array
      const workItem = jsonld.find((item: any) => 
        item['@type']?.includes('Work') || item['@type']?.includes('bf:Work')
      );
      if (workItem) {
        workUri = workItem['@id'] || workItem['@about'];
      }
    } else if (jsonld['@graph']) {
      // JSON-LD with @graph
      const workItem = jsonld['@graph'].find((item: any) => 
        item['@type']?.includes('Work') || item['@type']?.includes('bf:Work')
      );
      if (workItem) {
        workUri = workItem['@id'] || workItem['@about'];
      }
    } else {
      // Single object or LOC format
      // Find the first Work URI in the keys
      const keys = Object.keys(jsonld);
      workUri = keys.find(key => 
        key.startsWith('http') && 
        jsonld[key]['@type']?.some((t: string) => t.includes('Work'))
      ) || keys[0];
    }
    
    if (!workUri) {
      // Return as-is if we can't parse
      return c.json(jsonld);
    }
    
    const record = parseJSONLD(jsonld, workUri);
    return c.json(record);
  } catch (error) {
    console.error('Parse JSON-LD error:', error);
    return c.json({ error: 'Failed to parse JSON-LD' }, 500);
  }
});

// Parse RDF/XML endpoint for file imports
app.post("/make-server-49c0e13c/parse-rdfxml", async (c) => {
  try {
    const { rdfxml } = await c.req.json();
    
    if (!rdfxml) {
      return c.json({ error: 'rdfxml parameter required' }, 400);
    }

    console.log('Parsing RDF/XML from file upload');
    
    // Extract Work URI from RDF/XML
    const workUriMatch = rdfxml.match(/bf:Work.*?rdf:about="([^"]+)"/);
    const workUri = workUriMatch ? workUriMatch[1] : `http://example.org/work/${Date.now()}`;
    
    // Try to fetch JSON-LD version from LOC if it's a LOC URI
    if (workUri.startsWith('http://id.loc.gov')) {
      try {
        const jsonResponse = await fetch(`${workUri}.json`);
        if (jsonResponse.ok) {
          const jsonLdData = await jsonResponse.json();
          const record = parseJSONLD(jsonLdData, workUri);
          return c.json(record);
        }
      } catch (err) {
        console.error('Failed to fetch JSON-LD for RDF URI:', err);
      }
    }
    
    // If we can't get JSON-LD, return basic structure
    // In a production system, you'd use a full RDF/XML parser here
    return c.json({
      '@context': {
        bf: 'http://id.loc.gov/ontologies/bibframe/',
        rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
        rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      },
      work: {
        '@type': 'bf:Work',
        '@id': workUri,
        'bf:title': {
          '@type': 'bf:Title',
          'bf:mainTitle': 'Imported from RDF/XML - please complete',
        },
      },
      instance: {
        '@type': 'bf:Instance',
        '@id': `${workUri}/instance`,
        'bf:instanceOf': { '@id': workUri },
      },
      metadata: {
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        cataloger: 'Imported from RDF/XML',
        resourceType: 'Imported Record',
      },
    });
  } catch (error) {
    console.error('Parse RDF/XML error:', error);
    return c.json({ error: 'Failed to parse RDF/XML' }, 500);
  }
});

// Import BIBFRAME RDF/XML - accepts RDF/XML directly for import
app.post("/make-server-49c0e13c/import-bibframe-rdf", async (c) => {
  try {
    const { rdfXml, uri } = await c.req.json();
    
    if (!rdfXml && !uri) {
      return c.json({ error: 'Either rdfXml or uri parameter required' }, 400);
    }

    console.log('Importing BIBFRAME RDF...');

    // If URI provided, fetch the RDF
    let rdfContent = rdfXml;
    let workUri = uri;
    
    if (uri && !rdfXml) {
      console.log('Fetching RDF from URI:', uri);
      const response = await fetch(`${uri}.rdf`, {
        headers: {
          'Accept': 'application/rdf+xml',
        }
      });
      
      if (!response.ok) {
        // Try JSON-LD as fallback
        const jsonResponse = await fetch(`${uri}.json`);
        if (jsonResponse.ok) {
          const jsonLdData = await jsonResponse.json();
          const record = parseJSONLD(jsonLdData, uri);
          return c.json(record);
        }
        throw new Error('Failed to fetch RDF');
      }
      
      rdfContent = await response.text();
      workUri = uri;
    }
    
    // For now, if RDF/XML is provided, we recommend converting it via LOC's JSON-LD endpoint
    // This is because parsing RDF/XML requires XML parser which is more complex
    console.log('RDF/XML import - redirecting to JSON-LD endpoint');
    
    // Extract URI from RDF if not provided
    if (!workUri && rdfContent) {
      // Simple regex to extract work URI from RDF
      const match = rdfContent.match(/bf:Work.*?rdf:about="([^"]+)"/);
      if (match) {
        workUri = match[1];
      }
    }
    
    if (workUri) {
      // Fetch as JSON-LD instead
      const response = await fetch(`${workUri}.json`);
      if (response.ok) {
        const jsonLdData = await response.json();
        const record = parseJSONLD(jsonLdData, workUri);
        return c.json(record);
      }
    }
    
    return c.json({ 
      error: 'RDF/XML parsing not fully implemented. Please provide a LOC URI instead.',
      hint: 'Use the /load-bibframe endpoint with a uri parameter for best results.'
    }, 400);
  } catch (error) {
    console.error('Import BIBFRAME RDF error:', error);
    return c.json({ error: 'Failed to import RDF' }, 500);
  }
});

// Authority Search - NAF, VIAF, Wikidata, GeoNames
app.get("/make-server-49c0e13c/search-authority", async (c) => {
  try {
    const query = c.req.query('q');
    const source = c.req.query('source') || 'naf-personal';
    
    if (!query) {
      return c.json({ error: 'Query parameter required' }, 400);
    }

    let results = [];

    if (source.startsWith('naf-')) {
      // Use LOC suggest API for faster results
      const suggestUrl = `https://id.loc.gov/authorities/names/suggest/?q=${encodeURIComponent(query)}`;
      const response = await fetch(suggestUrl);
      
      if (response.ok) {
        const data = await response.json();
        
        for (const item of (data[1] || []).slice(0, 10)) {
          const index = data[1].indexOf(item);
          const uri = data[3]?.[index];
          const description = data[2]?.[index] || '';
          
          if (uri) {
            results.push({
              uri,
              label: item,
              description: description,
              type: 'Name Authority',
              source: 'LOC',
            });
          }
        }
      }
    } else if (source === 'naf-geographic') {
      // LOC Geographic Names
      const suggestUrl = `https://id.loc.gov/authorities/subjects/suggest/?q=${encodeURIComponent(query)}`;
      const response = await fetch(suggestUrl);
      
      if (response.ok) {
        const data = await response.json();
        
        for (const item of (data[1] || []).slice(0, 10)) {
          const index = data[1].indexOf(item);
          const uri = data[3]?.[index];
          
          if (uri && uri.includes('geographic')) {
            results.push({
              uri,
              label: item,
              type: 'Geographic',
              source: 'LOC',
            });
          }
        }
      }
    } else if (source === 'viaf') {
      // Search VIAF with better query
      const searchUrl = `https://viaf.org/viaf/AutoSuggest?query=${encodeURIComponent(query)}`;
      const response = await fetch(searchUrl);
      
      if (response.ok) {
        const data = await response.json();
        const records = data?.result || [];
        
        for (const record of records.slice(0, 10)) {
          if (record.viafid && record.term) {
            results.push({
              uri: `https://viaf.org/viaf/${record.viafid}`,
              label: record.term,
              description: record.nametype || '',
              type: record.nametype || 'Person',
              source: 'VIAF',
            });
          }
        }
      }
    } else if (source === 'wikidata') {
      // Search Wikidata
      const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=en&format=json&limit=10&origin=*`;
      const response = await fetch(searchUrl);
      
      if (response.ok) {
        const data = await response.json();
        
        for (const item of data.search || []) {
          results.push({
            uri: `https://www.wikidata.org/entity/${item.id}`,
            label: item.label || item.id,
            description: item.description || '',
            type: item.description || 'Entity',
            source: 'Wikidata',
          });
        }
      }
    } else if (source === 'geonames') {
      // GeoNames API (requires username - using demo account)
      const searchUrl = `http://api.geonames.org/searchJSON?q=${encodeURIComponent(query)}&maxRows=10&username=demo`;
      const response = await fetch(searchUrl);
      
      if (response.ok) {
        const data = await response.json();
        
        for (const place of data.geonames || []) {
          results.push({
            uri: `https://www.geonames.org/${place.geonameId}`,
            label: place.name,
            description: `${place.adminName1 || ''}, ${place.countryName || ''}`.replace(/^, /, ''),
            type: place.fcodeName || 'Geographic',
            source: 'GeoNames',
          });
        }
      }
    } else if (source === 'afiqa') {
      // AFIQA (Arabic Federated Identification and Qualification of Authorities)
      // Linked data authority records for Arabic scholars
      const afiqaAuthors = [
        {
          id: '24',
          name: 'الجواهري، محمد مهدي، 1899-1997',
          description: 'شاعر عراقي، شاعر العرب الأكبر',
          uri: 'https://afiqa.net/authority/24',
          isni: '0000000122843672',
          qid: 'Q4121866',
          lccn: 'PJ7840.A85',
          occupation: 'الشعراء',
          fieldOfActivity: 'الشعر العربي',
          birthDate: '1899-07-26',
          deathDate: '1997-07-27'
        },
        {
          id: '1421',
          name: 'الوائلي، احمد، 1347-1423 هجري',
          description: 'خطيب وعالم دين شيعي عراقي',
          uri: 'https://afiqa.net/authority/1421',
          isni: '0000000061605813',
          qid: 'Q4165199',
          occupation: 'رجال الدين الشيعة، الخطباء الشيعة',
          fieldOfActivity: 'الاسلام، الخطب الدينية الاسلامية',
          birthDate: '1928',
          deathDate: '2003'
        },
        {
          id: '2031',
          name: 'السامرائي، فاضل صالح، 1933-',
          description: 'عالم لغوي وأكاديمي عراقي متخصص في النحو والبلاغة',
          uri: 'https://afiqa.net/authority/2031',
          isni: '0000000123210623',
          qid: 'Q6823033',
          occupation: 'الاكاديميون، اللغويون',
          fieldOfActivity: 'اللغة العربية',
          birthDate: '1933'
        },
        {
          id: '15',
          name: 'ابو الطيب المتنبي، احمد بن الحسين بن الحسن، 303-354 هجري',
          description: 'شاعر عباسي، أحد أعظم شعراء العربية',
          uri: 'https://afiqa.net/authority/15',
          isni: '0000000122424312',
          qid: 'Q284542',
          lccn: 'PJ7750.M8',
          occupation: 'الشعراء',
          fieldOfActivity: 'الشعر العربي',
          birthDate: '915',
          deathDate: '965'
        }
      ];
      
      // Filter based on query (search in name, description, and IDs)
      const filtered = afiqaAuthors.filter(author => 
        author.name.toLowerCase().includes(query.toLowerCase()) ||
        author.description.toLowerCase().includes(query.toLowerCase()) ||
        author.id.includes(query) ||
        (author.isni && author.isni.includes(query)) ||
        (author.occupation && author.occupation.toLowerCase().includes(query.toLowerCase()))
      );
      
      results = filtered.map(author => ({
        uri: author.uri,
        label: author.name,
        description: author.description,
        type: 'Person',
        source: 'Afiqa',
        linkedData: {
          '@id': author.uri,
          '@type': 'bf:Person',
          isni: author.isni,
          wikidata: author.qid ? `http://www.wikidata.org/entity/${author.qid}` : undefined,
          lccn: author.lccn ? `http://id.loc.gov/authorities/names/${author.lccn}` : undefined,
          occupation: author.occupation,
          fieldOfActivity: author.fieldOfActivity,
          birthDate: author.birthDate,
          deathDate: author.deathDate
        }
      }));
    }

    return c.json({ results });
  } catch (error) {
    console.error('Authority search error:', error);
    return c.json({ error: 'Search failed', results: [] }, 500);
  }
});







// ============================================================================
// JCRICKET COLLABORATIVE ENTITY MANAGEMENT ENDPOINTS
// ============================================================================

// Get user profile with JCricket settings
app.get("/make-server-49c0e13c/jcricket/profile", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (authError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Load user profile from KV store
    const profileKey = `jcricket:profile:${user.id}`;
    const storedProfile = await kv.get(profileKey);
    
    let profile;
    if (!storedProfile) {
      // Create default profile
      profile = {
        userId: user.id,
        username: user.user_metadata?.username || user.email,
        email: user.email,
        role: 'basic_editor',
        provenanceId: 'default',
        provenances: ['default'],
        proficientLanguages: ['en'],
        preferences: {
          showAllLanguages: true,
          autoSaveEnabled: true,
          notificationsEnabled: true,
        },
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
      };
      await kv.set(profileKey, JSON.stringify(profile));
    } else {
      profile = JSON.parse(storedProfile);
      // Update last login
      profile.lastLogin = new Date().toISOString();
      await kv.set(profileKey, JSON.stringify(profile));
    }

    // Load available provenances
    const provenancesData = await kv.getByPrefix('jcricket:provenance:');
    const provenances = provenancesData.map(p => JSON.parse(p));
    
    // Add default provenance if none exist
    if (provenances.length === 0) {
      const defaultProvenance = {
        id: 'default',
        name: 'Default Institution',
        code: 'DEFAULT',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await kv.set('jcricket:provenance:default', JSON.stringify(defaultProvenance));
      provenances.push(defaultProvenance);
    }

    return c.json({ profile, provenances });
  } catch (error) {
    console.error('Get profile error:', error);
    return c.json({ error: 'Failed to get profile' }, 500);
  }
});

// Update language preferences
app.put("/make-server-49c0e13c/jcricket/profile/languages", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (authError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { languages } = await c.req.json();
    const profileKey = `jcricket:profile:${user.id}`;
    const storedProfile = await kv.get(profileKey);
    
    if (!storedProfile) {
      return c.json({ error: 'Profile not found' }, 404);
    }

    const profile = JSON.parse(storedProfile);
    profile.proficientLanguages = languages;
    await kv.set(profileKey, JSON.stringify(profile));

    return c.json({ success: true, profile });
  } catch (error) {
    console.error('Update languages error:', error);
    return c.json({ error: 'Failed to update languages' }, 500);
  }
});

// Get user notifications
app.get("/make-server-49c0e13c/jcricket/notifications", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (authError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get all notifications for this user
    const notificationsData = await kv.getByPrefix(`jcricket:notification:${user.id}:`);
    const notifications = notificationsData.map(n => JSON.parse(n)).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return c.json({ notifications });
  } catch (error) {
    console.error('Get notifications error:', error);
    return c.json({ error: 'Failed to get notifications' }, 500);
  }
});

// Mark notification as read
app.post("/make-server-49c0e13c/jcricket/notifications/:id/read", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (authError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const notificationId = c.req.param('id');
    const notificationKey = `jcricket:notification:${user.id}:${notificationId}`;
    const notificationData = await kv.get(notificationKey);
    
    if (!notificationData) {
      return c.json({ error: 'Notification not found' }, 404);
    }

    const notification = JSON.parse(notificationData);
    notification.isRead = true;
    await kv.set(notificationKey, JSON.stringify(notification));

    return c.json({ success: true });
  } catch (error) {
    console.error('Mark notification read error:', error);
    return c.json({ error: 'Failed to mark notification as read' }, 500);
  }
});

// Get review queue
app.get("/make-server-49c0e13c/jcricket/review-queue", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (authError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get all pending reviews
    const reviewsData = await kv.getByPrefix('jcricket:review:');
    const queue = reviewsData
      .map(r => JSON.parse(r))
      .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());

    return c.json({ queue });
  } catch (error) {
    console.error('Get review queue error:', error);
    return c.json({ error: 'Failed to get review queue' }, 500);
  }
});

// Get collaboration statistics
app.get("/make-server-49c0e13c/jcricket/stats", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (authError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get cluster statistics
    const clustersData = await kv.getByPrefix('jcricket:cluster:');
    const clusters = clustersData.map(c => JSON.parse(c));
    
    // Count by provenance
    const clustersByProvenance: Record<string, number> = {};
    for (const cluster of clusters) {
      for (const facet of cluster.facets || []) {
        clustersByProvenance[facet.provenanceName] = (clustersByProvenance[facet.provenanceName] || 0) + 1;
      }
    }

    // Get recent edits (last 7 days)
    const eventsData = await kv.getByPrefix('jcricket:event:');
    const events = eventsData.map(e => JSON.parse(e));
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentEdits = events.filter(e => new Date(e.timestamp) > sevenDaysAgo).length;

    // Get merges and splits this month
    const thisMonth = new Date().getMonth();
    const mergesThisMonth = events.filter(e => 
      e.eventType === 'merge' && new Date(e.timestamp).getMonth() === thisMonth
    ).length;
    const splitsThisMonth = events.filter(e => 
      e.eventType === 'split' && new Date(e.timestamp).getMonth() === thisMonth
    ).length;

    // Get active editors
    const uniqueEditors = new Set(events.filter(e => 
      new Date(e.timestamp).getMonth() === thisMonth
    ).map(e => e.userId));
    const activeEditors = uniqueEditors.size;

    // Get top contributors
    const contributionCounts: Record<string, { username: string; count: number }> = {};
    for (const event of events) {
      if (new Date(event.timestamp).getMonth() === thisMonth) {
        if (!contributionCounts[event.userId]) {
          contributionCounts[event.userId] = { username: event.username, count: 0 };
        }
        contributionCounts[event.userId].count++;
      }
    }
    const topContributors = Object.entries(contributionCounts)
      .map(([userId, data]) => ({ userId, ...data, contributionCount: data.count }))
      .sort((a, b) => b.contributionCount - a.contributionCount)
      .slice(0, 10);

    const stats = {
      totalClusters: clusters.length,
      clustersByProvenance,
      recentEdits,
      pendingReviews: 0, // Calculated from review queue
      mergesThisMonth,
      splitsThisMonth,
      activeEditors,
      topContributors,
    };

    return c.json({ stats });
  } catch (error) {
    console.error('Get stats error:', error);
    return c.json({ error: 'Failed to get statistics' }, 500);
  }
});

// Request merge operation
app.post("/make-server-49c0e13c/jcricket/merge", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (authError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Check if user is advanced editor
    const profileKey = `jcricket:profile:${user.id}`;
    const profileData = await kv.get(profileKey);
    if (!profileData) {
      return c.json({ error: 'Profile not found' }, 404);
    }
    const profile = JSON.parse(profileData);
    if (profile.role !== 'advanced_editor' && profile.role !== 'admin') {
      return c.json({ error: 'Only advanced editors can perform merges' }, 403);
    }

    const { destinationClusterId, sourceClusterIds, selectedProperties, reviewerUsername, notes } = await c.req.json();

    // Create merge operation
    const operationId = `merge-${Date.now()}`;
    const operation = {
      id: operationId,
      destinationClusterId,
      sourceClusterIds,
      selectedProperties,
      status: 'pending_review',
      createdBy: user.id,
      createdAt: new Date().toISOString(),
    };

    await kv.set(`jcricket:merge:${operationId}`, JSON.stringify(operation));

    // Create review queue item
    const reviewItem = {
      id: `review-${Date.now()}`,
      operationType: 'merge',
      operationId,
      clusterIds: [destinationClusterId, ...sourceClusterIds],
      requestedBy: user.id,
      requestedByName: profile.username,
      requestedAt: new Date().toISOString(),
      priority: 'medium',
      status: 'pending',
    };

    await kv.set(`jcricket:review:${reviewItem.id}`, JSON.stringify(reviewItem));

    // Log event
    const eventId = `event-${Date.now()}`;
    const event = {
      id: eventId,
      eventType: 'merge',
      clusterId: destinationClusterId,
      userId: user.id,
      username: profile.username,
      provenanceId: profile.provenanceId,
      provenanceName: 'Default',
      changes: [],
      timestamp: new Date().toISOString(),
      description: `Merge operation requested: ${sourceClusterIds.length} sources to destination`,
    };

    await kv.set(`jcricket:event:${eventId}`, JSON.stringify(event));

    return c.json({ success: true, operationId, reviewItemId: reviewItem.id });
  } catch (error) {
    console.error('Merge request error:', error);
    return c.json({ error: 'Failed to create merge request' }, 500);
  }
});

// Request split operation
app.post("/make-server-49c0e13c/jcricket/split", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (authError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Check if user is advanced editor
    const profileKey = `jcricket:profile:${user.id}`;
    const profileData = await kv.get(profileKey);
    if (!profileData) {
      return c.json({ error: 'Profile not found' }, 404);
    }
    const profile = JSON.parse(profileData);
    if (profile.role !== 'advanced_editor' && profile.role !== 'admin') {
      return c.json({ error: 'Only advanced editors can perform splits' }, 403);
    }

    const { giverClusterId, receiverClusterId, movedProperties, reviewerUsername, notes } = await c.req.json();

    // Create split operation
    const operationId = `split-${Date.now()}`;
    const operation = {
      id: operationId,
      giverClusterId,
      receiverClusterId,
      movedProperties,
      status: 'pending_review',
      createdBy: user.id,
      createdAt: new Date().toISOString(),
    };

    await kv.set(`jcricket:split:${operationId}`, JSON.stringify(operation));

    // Create review queue item
    const reviewItem = {
      id: `review-${Date.now()}`,
      operationType: 'split',
      operationId,
      clusterIds: [giverClusterId, receiverClusterId],
      requestedBy: user.id,
      requestedByName: profile.username,
      requestedAt: new Date().toISOString(),
      priority: 'medium',
      status: 'pending',
    };

    await kv.set(`jcricket:review:${reviewItem.id}`, JSON.stringify(reviewItem));

    // Log event
    const eventId = `event-${Date.now()}`;
    const event = {
      id: eventId,
      eventType: 'split',
      clusterId: giverClusterId,
      userId: user.id,
      username: profile.username,
      provenanceId: profile.provenanceId,
      provenanceName: 'Default',
      changes: [],
      timestamp: new Date().toISOString(),
      description: `Split operation requested: moving ${Object.keys(movedProperties).length} properties`,
    };

    await kv.set(`jcricket:event:${eventId}`, JSON.stringify(event));

    return c.json({ success: true, operationId, reviewItemId: reviewItem.id });
  } catch (error) {
    console.error('Split request error:', error);
    return c.json({ error: 'Failed to create split request' }, 500);
  }
});

// Get merge/split operation details
app.get("/make-server-49c0e13c/jcricket/:type/:id", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (authError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const type = c.req.param('type');
    const id = c.req.param('id');

    if (type !== 'merge' && type !== 'split') {
      return c.json({ error: 'Invalid operation type' }, 400);
    }

    const operationData = await kv.get(`jcricket:${type}:${id}`);
    if (!operationData) {
      return c.json({ error: 'Operation not found' }, 404);
    }

    const operation = JSON.parse(operationData);
    return c.json({ operation });
  } catch (error) {
    console.error('Get operation error:', error);
    return c.json({ error: 'Failed to get operation' }, 500);
  }
});

// Approve merge/split operation
app.post("/make-server-49c0e13c/jcricket/:type/:id/approve", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (authError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const type = c.req.param('type');
    const id = c.req.param('id');
    const { reviewNotes } = await c.req.json();

    const operationKey = `jcricket:${type}:${id}`;
    const operationData = await kv.get(operationKey);
    if (!operationData) {
      return c.json({ error: 'Operation not found' }, 404);
    }

    const operation = JSON.parse(operationData);
    operation.status = 'approved';
    operation.reviewedBy = user.id;
    operation.reviewedAt = new Date().toISOString();
    operation.reviewNotes = reviewNotes;
    await kv.set(operationKey, JSON.stringify(operation));

    // Update review queue
    const reviewsData = await kv.getByPrefix('jcricket:review:');
    for (const reviewStr of reviewsData) {
      const review = JSON.parse(reviewStr);
      if (review.operationId === id) {
        review.status = 'completed';
        await kv.set(`jcricket:review:${review.id}`, JSON.stringify(review));
        break;
      }
    }

    // Log approval event
    const profileKey = `jcricket:profile:${user.id}`;
    const profileData = await kv.get(profileKey);
    const profile = profileData ? JSON.parse(profileData) : { username: user.email };

    const eventId = `event-${Date.now()}`;
    const event = {
      id: eventId,
      eventType: 'review_approve',
      clusterId: type === 'merge' ? operation.destinationClusterId : operation.giverClusterId,
      userId: user.id,
      username: profile.username,
      provenanceId: profile.provenanceId || 'default',
      provenanceName: 'Default',
      changes: [],
      timestamp: new Date().toISOString(),
      description: `${type.charAt(0).toUpperCase() + type.slice(1)} operation approved`,
    };

    await kv.set(`jcricket:event:${eventId}`, JSON.stringify(event));

    return c.json({ success: true });
  } catch (error) {
    console.error('Approve operation error:', error);
    return c.json({ error: 'Failed to approve operation' }, 500);
  }
});

// Reject merge/split operation
app.post("/make-server-49c0e13c/jcricket/:type/:id/reject", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (authError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const type = c.req.param('type');
    const id = c.req.param('id');
    const { reviewNotes } = await c.req.json();

    if (!reviewNotes || !reviewNotes.trim()) {
      return c.json({ error: 'Review notes required for rejection' }, 400);
    }

    const operationKey = `jcricket:${type}:${id}`;
    const operationData = await kv.get(operationKey);
    if (!operationData) {
      return c.json({ error: 'Operation not found' }, 404);
    }

    const operation = JSON.parse(operationData);
    operation.status = 'rejected';
    operation.reviewedBy = user.id;
    operation.reviewedAt = new Date().toISOString();
    operation.reviewNotes = reviewNotes;
    await kv.set(operationKey, JSON.stringify(operation));

    // Update review queue
    const reviewsData = await kv.getByPrefix('jcricket:review:');
    for (const reviewStr of reviewsData) {
      const review = JSON.parse(reviewStr);
      if (review.operationId === id) {
        review.status = 'completed';
        await kv.set(`jcricket:review:${review.id}`, JSON.stringify(review));
        break;
      }
    }

    // Log rejection event
    const profileKey = `jcricket:profile:${user.id}`;
    const profileData = await kv.get(profileKey);
    const profile = profileData ? JSON.parse(profileData) : { username: user.email };

    const eventId = `event-${Date.now()}`;
    const event = {
      id: eventId,
      eventType: 'review_reject',
      clusterId: type === 'merge' ? operation.destinationClusterId : operation.giverClusterId,
      userId: user.id,
      username: profile.username,
      provenanceId: profile.provenanceId || 'default',
      provenanceName: 'Default',
      changes: [],
      timestamp: new Date().toISOString(),
      description: `${type.charAt(0).toUpperCase() + type.slice(1)} operation rejected: ${reviewNotes}`,
    };

    await kv.set(`jcricket:event:${eventId}`, JSON.stringify(event));

    return c.json({ success: true });
  } catch (error) {
    console.error('Reject operation error:', error);
    return c.json({ error: 'Failed to reject operation' }, 500);
  }
});

// Get entity event log
app.get("/make-server-49c0e13c/jcricket/events", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (authError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const clusterId = c.req.query('clusterId');

    // Get all events
    const eventsData = await kv.getByPrefix('jcricket:event:');
    let events = eventsData.map(e => JSON.parse(e));

    // Filter by cluster ID if provided
    if (clusterId) {
      events = events.filter(e => e.clusterId === clusterId);
    }

    // Sort by timestamp descending
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return c.json({ events });
  } catch (error) {
    console.error('Get events error:', error);
    return c.json({ error: 'Failed to get events' }, 500);
  }
});

// Check concurrent edits
app.get("/make-server-49c0e13c/jcricket/cluster/:id/concurrent-edits", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (authError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const clusterId = c.req.param('id');

    // Get active edit sessions for this cluster
    const sessionsData = await kv.getByPrefix(`jcricket:edit-session:${clusterId}:`);
    const currentEditors = sessionsData
      .map(s => JSON.parse(s))
      .filter(s => {
        // Filter out sessions older than 5 minutes
        const sessionAge = Date.now() - new Date(s.editingSince).getTime();
        return sessionAge < 5 * 60 * 1000;
      })
      .filter(s => s.userId !== user.id); // Exclude current user

    if (currentEditors.length > 0) {
      const warning = {
        clusterId,
        currentEditors,
        lastModified: new Date().toISOString(),
        lastModifiedBy: 'Unknown',
      };
      return c.json({ warning });
    }

    return c.json({ warning: null });
  } catch (error) {
    console.error('Check concurrent edits error:', error);
    return c.json({ error: 'Failed to check concurrent edits' }, 500);
  }
});

// ═══════════════════════════════════════════════════════════
// 📚 ISBNdb API PROXY (Secure API Key Handling)
// ═══════════════════════════════════════════════════════════

const ISBNDB_BASE_URL = 'https://api2.isbndb.com';

// Helper: get cleaned ISBNdb API key (strips whitespace, quotes, accidental "Bearer " prefix)
function getIsbndbApiKey(): string | null {
  const raw = Deno.env.get('ISBNDB_API_KEY');
  if (!raw) return null;
  let key = raw.trim().replace(/^["']|["']$/g, '');
  if (key.toLowerCase().startsWith('bearer ')) {
    key = key.slice(7).trim();
  }
  return key || null;
}

// Helper: make authenticated ISBNdb fetch
async function isbndbFetch(path: string, method: string = 'GET', body?: string): Promise<Response> {
  const apiKey = getIsbndbApiKey();
  if (!apiKey) throw new Error('ISBNDB_API_KEY not configured');
  console.log(`ISBNdb request: ${method} ${path} (key length: ${apiKey.length}, starts: ${apiKey.substring(0, 4)}...)`);
  const opts: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': apiKey,
    },
  };
  if (body) opts.body = body;
  return fetch(`${ISBNDB_BASE_URL}${path}`, opts);
}

// 📖 Get book by ISBN
app.get("/make-server-49c0e13c/isbndb/book/:isbn", async (c) => {
  try {
    const isbn = c.req.param('isbn');
    const cleanIsbn = isbn.replace(/[^0-9X]/gi, '');
    
    const response = await isbndbFetch(`/book/${cleanIsbn}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return c.json({ error: 'Book not found', message: 'Data may be added soon' }, 404);
      }
      if (response.status === 429) {
        return c.json({ error: 'Rate limit exceeded' }, 429);
      }
      const errorText = await response.text();
      console.error('ISBNdb API error:', response.status, errorText);
      return c.json({ error: 'ISBNdb API error', details: errorText }, response.status as any);
    }
    
    const data = await response.json();
    return c.json(data);
  } catch (error) {
    console.error('ISBNdb book lookup error:', error);
    return c.json({ error: 'Failed to fetch book from ISBNdb', details: String(error) }, 500);
  }
});

// 📚 Get multiple books by ISBNs
app.post("/make-server-49c0e13c/isbndb/books", async (c) => {
  try {
    const { isbns } = await c.req.json();
    
    if (!isbns || !Array.isArray(isbns)) {
      return c.json({ error: 'isbns array required' }, 400);
    }
    
    const cleanIsbns = isbns.map((isbn: string) => isbn.replace(/[^0-9X]/gi, ''));
    
    const response = await isbndbFetch('/books', 'POST', `isbns=${cleanIsbns.join(',')}`);
    
    if (!response.ok) {
      if (response.status === 429) {
        return c.json({ error: 'Rate limit exceeded' }, 429);
      }
      const errorText = await response.text();
      console.error('ISBNdb API error:', response.status, errorText);
      return c.json({ error: 'ISBNdb API error', details: errorText }, response.status as any);
    }
    
    const data = await response.json();
    return c.json(data);
  } catch (error) {
    console.error('ISBNdb bulk lookup error:', error);
    return c.json({ error: 'Failed to fetch books from ISBNdb', details: String(error) }, 500);
  }
});

// 🔍 Search books
app.get("/make-server-49c0e13c/isbndb/search/books/:query", async (c) => {
  try {
    const query = c.req.param('query');
    const page = c.req.query('page') || '1';
    const pageSize = c.req.query('pageSize') || '20';
    const params = new URLSearchParams({ page, pageSize });
    
    const response = await isbndbFetch(`/books/${encodeURIComponent(query)}?${params}`);
    
    if (!response.ok) {
      if (response.status === 429) {
        return c.json({ error: 'Rate limit exceeded' }, 429);
      }
      const errorText = await response.text();
      console.error('ISBNdb API error:', response.status, errorText);
      return c.json({ error: 'ISBNdb API error', details: errorText }, response.status as any);
    }
    
    const data = await response.json();
    return c.json(data);
  } catch (error) {
    console.error('ISBNdb search error:', error);
    return c.json({ error: 'Failed to search ISBNdb', details: String(error) }, 500);
  }
});

// 👤 Search authors
app.get("/make-server-49c0e13c/isbndb/search/authors/:query", async (c) => {
  try {
    const query = c.req.param('query');
    const page = c.req.query('page') || '1';
    const pageSize = c.req.query('pageSize') || '20';
    const params = new URLSearchParams({ page, pageSize });
    
    const response = await isbndbFetch(`/authors/${encodeURIComponent(query)}?${params}`);
    
    if (!response.ok) {
      if (response.status === 429) {
        return c.json({ error: 'Rate limit exceeded' }, 429);
      }
      const errorText = await response.text();
      console.error('ISBNdb API error:', response.status, errorText);
      return c.json({ error: 'ISBNdb API error', details: errorText }, response.status as any);
    }
    
    const data = await response.json();
    return c.json(data);
  } catch (error) {
    console.error('ISBNdb author search error:', error);
    return c.json({ error: 'Failed to search authors in ISBNdb', details: String(error) }, 500);
  }
});

// 👤 Get author details
app.get("/make-server-49c0e13c/isbndb/author/:name", async (c) => {
  try {
    const name = c.req.param('name');
    
    const response = await isbndbFetch(`/author/${encodeURIComponent(name)}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return c.json({ error: 'Author not found' }, 404);
      }
      if (response.status === 429) {
        return c.json({ error: 'Rate limit exceeded' }, 429);
      }
      const errorText = await response.text();
      console.error('ISBNdb API error:', response.status, errorText);
      return c.json({ error: 'ISBNdb API error', details: errorText }, response.status as any);
    }
    
    const data = await response.json();
    return c.json(data);
  } catch (error) {
    console.error('ISBNdb author details error:', error);
    return c.json({ error: 'Failed to get author from ISBNdb', details: String(error) }, 500);
  }
});

// 🏢 Search publishers
app.get("/make-server-49c0e13c/isbndb/search/publishers/:query", async (c) => {
  try {
    const query = c.req.param('query');
    const page = c.req.query('page') || '1';
    const pageSize = c.req.query('pageSize') || '20';
    const params = new URLSearchParams({ page, pageSize });
    
    const response = await isbndbFetch(`/publishers/${encodeURIComponent(query)}?${params}`);
    
    if (!response.ok) {
      if (response.status === 429) {
        return c.json({ error: 'Rate limit exceeded' }, 429);
      }
      const errorText = await response.text();
      console.error('ISBNdb API error:', response.status, errorText);
      return c.json({ error: 'ISBNdb API error', details: errorText }, response.status as any);
    }
    
    const data = await response.json();
    return c.json(data);
  } catch (error) {
    console.error('ISBNdb publisher search error:', error);
    return c.json({ error: 'Failed to search publishers in ISBNdb', details: String(error) }, 500);
  }
});

// 🏷️ Search subjects
app.get("/make-server-49c0e13c/isbndb/search/subjects/:query", async (c) => {
  try {
    const query = c.req.param('query');
    const page = c.req.query('page') || '1';
    const pageSize = c.req.query('pageSize') || '20';
    const params = new URLSearchParams({ page, pageSize });
    
    const response = await isbndbFetch(`/subjects/${encodeURIComponent(query)}?${params}`);
    
    if (!response.ok) {
      if (response.status === 429) {
        return c.json({ error: 'Rate limit exceeded' }, 429);
      }
      const errorText = await response.text();
      console.error('ISBNdb API error:', response.status, errorText);
      return c.json({ error: 'ISBNdb API error', details: errorText }, response.status as any);
    }
    
    const data = await response.json();
    return c.json(data);
  } catch (error) {
    console.error('ISBNdb subject search error:', error);
    return c.json({ error: 'Failed to search subjects in ISBNdb', details: String(error) }, 500);
  }
});

// 🏢 Get publisher details
app.get("/make-server-49c0e13c/isbndb/publisher/:name", async (c) => {
  try {
    const name = c.req.param('name');
    
    const response = await isbndbFetch(`/publisher/${encodeURIComponent(name)}`);
    
    if (!response.ok) {
       if (response.status === 404) return c.json({ error: 'Publisher not found' }, 404);
       const errorText = await response.text();
       console.error('ISBNdb API error:', response.status, errorText);
       return c.json({ error: 'ISBNdb API error', details: errorText }, response.status as any);
    }
    
    const data = await response.json();
    return c.json(data);
  } catch (error) {
    console.error('ISBNdb publisher details error:', error);
    return c.json({ error: 'Failed to get publisher from ISBNdb', details: String(error) }, 500);
  }
});

// 🏷️ Get subject details
app.get("/make-server-49c0e13c/isbndb/subject/:name", async (c) => {
  try {
    const name = c.req.param('name');
    
    const response = await isbndbFetch(`/subject/${encodeURIComponent(name)}`);
    
    if (!response.ok) {
       if (response.status === 404) return c.json({ error: 'Subject not found' }, 404);
       const errorText = await response.text();
       console.error('ISBNdb API error:', response.status, errorText);
       return c.json({ error: 'ISBNdb API error', details: errorText }, response.status as any);
    }
    
    const data = await response.json();
    return c.json(data);
  } catch (error) {
    console.error('ISBNdb subject details error:', error);
    return c.json({ error: 'Failed to get subject from ISBNdb', details: String(error) }, 500);
  }
});

// 📊 Get ISBNdb stats
app.get("/make-server-49c0e13c/isbndb/stats", async (c) => {
  try {
    const response = await isbndbFetch('/stats');
    
    if (!response.ok) {
       const errorText = await response.text();
       console.error('ISBNdb API error:', response.status, errorText);
       return c.json({ error: 'ISBNdb API error', details: errorText }, response.status as any);
    }
    
    const data = await response.json();
    return c.json(data);
  } catch (error) {
    console.error('ISBNdb stats error:', error);
    return c.json({ error: 'Failed to get stats from ISBNdb', details: String(error) }, 500);
  }
});

// ═══════════════════════════════════════════════════════════
// 🌕 MOON LINKED DATA RECORDS API
// Complete JSON-LD storage shared by Moon Engine & Moon OPAC
// ═══════════════════════════════════════════════════════════

// 💾 Create/Update MOON Record (POST /moon/records)
// 🔒 PROTECTED: Requires authentication + records.create permission
app.post("/make-server-49c0e13c/moon/records", 
  authMiddleware.requireAuth,
  authMiddleware.requirePermission('records.create'),
  authMiddleware.auditLog,
  async (c) => {
  try {
    const user = (c as any).user;
    const payload = await c.req.json();
    
    // 🔒 ENFORCE: Institution isolation
    payload.institutionId = user.institutionId;
    
    const record = await moonRecords.saveMoonRecord(payload);
    return c.json(record, 201);
  } catch (error) {
    console.error('[MOON API] Save record error:', error);
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to save record' 
    }, 400);
  }
});

// 📋 List All MOON Records (GET /moon/records)
// 🔒 PROTECTED: Requires authentication + records.read permission
app.get("/make-server-49c0e13c/moon/records",
  authMiddleware.requireAuth,
  authMiddleware.requirePermission('records.read'),
  async (c) => {
  try {
    const user = (c as any).user;
    const status = c.req.query('status');
    const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : undefined;
    const offset = c.req.query('offset') ? parseInt(c.req.query('offset')!) : undefined;
    
    // 🔒 ENFORCE: Only return records from user's institution
    const records = await dataIsolation.listRecords(user.institutionId, { limit, offset });
    return c.json({ records, count: records.length });
  } catch (error) {
    console.error('[MOON API] List records error:', error);
    return c.json({ error: 'Failed to list records' }, 500);
  }
});

// 📖 Get Single MOON Record (GET /moon/records/:id)
// 🔒 PROTECTED: Requires authentication + records.read permission
app.get("/make-server-49c0e13c/moon/records/:id",
  authMiddleware.requireAuth,
  authMiddleware.requirePermission('records.read'),
  async (c) => {
  try {
    const user = (c as any).user;
    const id = c.req.param('id');
    
    // 🔒 ENFORCE: Institution isolation
    const record = await dataIsolation.getRecord(id, user.institutionId);
    
    if (!record) {
      return c.json({ error: 'Record not found or access denied' }, 404);
    }
    
    return c.json(record);
  } catch (error) {
    console.error('[MOON API] Get record error:', error);
    return c.json({ error: 'Failed to get record' }, 500);
  }
});

// 🔄 Update MOON Record (PUT /moon/records/:id)
// 🔒 PROTECTED: Requires authentication + records.edit permission
app.put("/make-server-49c0e13c/moon/records/:id",
  authMiddleware.requireAuth,
  authMiddleware.requirePermission('records.edit'),
  authMiddleware.auditLog,
  async (c) => {
  try {
    const user = (c as any).user;
    const id = c.req.param('id');
    const payload = await c.req.json();
    
    // 🔒 SECURITY: Verify record belongs to user's institution
    const existing = await dataIsolation.getRecord(id, user.institutionId);
    if (!existing) {
      return c.json({ error: 'Record not found or access denied' }, 404);
    }
    
    // Ensure ID matches and institution is locked
    payload.id = id;
    payload.institutionId = user.institutionId;
    
    const record = await moonRecords.saveMoonRecord(payload);
    return c.json(record);
  } catch (error) {
    console.error('[MOON API] Update record error:', error);
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to update record' 
    }, 400);
  }
});

// 🗑️ Delete MOON Record (DELETE /moon/records/:id)
// 🔒 ADMIN ONLY: Destructive operation
app.delete("/make-server-49c0e13c/moon/records/:id",
  authMiddleware.requireAuth,
  authMiddleware.requireAdmin,
  authMiddleware.auditLog,
  async (c) => {
  try {
    const user = (c as any).user;
    const id = c.req.param('id');
    
    // 🔒 SECURITY: Verify record belongs to user's institution (even for admins)
    const success = await dataIsolation.deleteRecord(id, user.institutionId);
    
    if (!success) {
      return c.json({ error: 'Record not found or deletion failed' }, 500);
    }
    
    return c.json({ success: true, id });
  } catch (error) {
    console.error('[MOON API] Delete record error:', error);
    return c.json({ error: 'Failed to delete record' }, 500);
  }
});

// 🔍 Search MOON Records (GET /moon/search?q=query)
// 🔒 PROTECTED: Requires authentication + records.read permission
app.get("/make-server-49c0e13c/moon/search",
  authMiddleware.requireAuth,
  authMiddleware.requirePermission('records.read'),
  async (c) => {
  try {
    const user = (c as any).user;
    const query = c.req.query('q');
    
    if (!query) {
      return c.json({ error: 'Query parameter required' }, 400);
    }
    
    // 🔒 ENFORCE: Search only within user's institution
    const records = await dataIsolation.searchRecords(user.institutionId, query, {
      limit: 100
    });
    return c.json({ records, count: records.length });
  } catch (error) {
    console.error('[MOON API] Search error:', error);
    return c.json({ error: 'Search failed' }, 500);
  }
});

// ✅ Validate JSON-LD Document with SHACL (POST /moon/validate)
// 🔒 PROTECTED: Requires authentication
app.post("/make-server-49c0e13c/moon/validate",
  authMiddleware.requireAuth,
  async (c) => {
  try {
    const { document, tripleStoreConfig, skipShacl } = await c.req.json();
    
    if (!document) {
      return c.json({ error: 'Document is required' }, 400);
    }

    // Basic JSON-LD validation first
    const basicValidation = moonRecords.validateJSONLD(document);
    
    if (!basicValidation.valid) {
      return c.json({
        valid: false,
        type: 'json-ld',
        errors: basicValidation.errors
      });
    }

    // ⚠️ SHACL validation (requires triple store connection)
    if (tripleStoreConfig && !skipShacl) {
      console.log('[VALIDATION] Running SHACL validation...');
      
      const shaclResult = await shaclValidator.validateDocument(document, tripleStoreConfig);
      
      return c.json({
        valid: shaclResult.valid,
        type: 'shacl',
        violations: shaclResult.violations,
        warnings: shaclResult.warnings,
        info: shaclResult.info
      });
    }

    // Without triple store, only basic validation
    return c.json({
      valid: true,
      type: 'json-ld',
      message: 'Basic JSON-LD validation passed. Connect triple store for SHACL validation.'
    });
  } catch (error) {
    console.error('[MOON API] Validation error:', error);
    return c.json({ error: 'Validation failed', details: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

// 🎯 AUTHORITY MANAGEMENT ENDPOINTS

// List all authorities (GET /moon/authorities)
app.get("/make-server-49c0e13c/moon/authorities", async (c) => {
  try {
    const type = c.req.query('type');
    const verified = c.req.query('verified');
    const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : undefined;
    const offset = c.req.query('offset') ? parseInt(c.req.query('offset')!) : undefined;

    const authList = await authorities.listAuthorities({
      type,
      verified: verified === 'true' ? true : verified === 'false' ? false : undefined,
      limit,
      offset
    });

    return c.json({ authorities: authList, count: authList.length });
  } catch (error) {
    console.error('[MOON API] List authorities error:', error);
    return c.json({ error: 'Failed to list authorities' }, 500);
  }
});

// Search authorities (GET /moon/authorities/search?q=query)
app.get("/make-server-49c0e13c/moon/authorities/search", async (c) => {
  try {
    const query = c.req.query('q');
    const type = c.req.query('type');
    const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : 20;

    if (!query) {
      return c.json({ error: 'Query parameter required' }, 400);
    }

    const results = await authorities.searchAuthorities(query, { type, limit });
    return c.json({ authorities: results, count: results.length });
  } catch (error) {
    console.error('[MOON API] Search authorities error:', error);
    return c.json({ error: 'Search failed' }, 500);
  }
});

// Get authority by ID (GET /moon/authorities/:id)
app.get("/make-server-49c0e13c/moon/authorities/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const authority = await authorities.getAuthority(id);

    if (!authority) {
      return c.json({ error: 'Authority not found' }, 404);
    }

    return c.json(authority);
  } catch (error) {
    console.error('[MOON API] Get authority error:', error);
    return c.json({ error: 'Failed to get authority' }, 500);
  }
});

// Create/Update authority (POST /moon/authorities)
// 🔒 PROTECTED: Requires authentication + authorities.create permission
app.post("/make-server-49c0e13c/moon/authorities",
  authMiddleware.requireAuth,
  authMiddleware.requirePermission('authorities.create'),
  authMiddleware.auditLog,
  async (c) => {
  try {
    const user = (c as any).user;
    const authorityData = await c.req.json();
    
    // 🔒 ENFORCE: Institution isolation
    const savedAuthority = await dataIsolation.saveAuthority(
      authorityData.id || crypto.randomUUID(),
      user.institutionId,
      authorityData,
      user.id
    );
    return c.json(savedAuthority);
  } catch (error) {
    console.error('[MOON API] Save authority error:', error);
    return c.json({ error: 'Failed to save authority', details: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

// Find duplicate authorities (POST /moon/authorities/:id/duplicates)
app.post("/make-server-49c0e13c/moon/authorities/:id/duplicates", async (c) => {
  try {
    const id = c.req.param('id');
    const threshold = parseFloat(c.req.query('threshold') || '0.8');
    
    const authority = await authorities.getAuthority(id);
    if (!authority) {
      return c.json({ error: 'Authority not found' }, 404);
    }

    const duplicates = await authorities.findDuplicates(authority, threshold);
    return c.json({ duplicates, count: duplicates.length });
  } catch (error) {
    console.error('[MOON API] Find duplicates error:', error);
    return c.json({ error: 'Failed to find duplicates' }, 500);
  }
});

// Analyze merge impact (POST /moon/authorities/merge/analyze)
// 🔒 ADMIN ONLY: Preview what will be affected before merging
app.post("/make-server-49c0e13c/moon/authorities/merge/analyze",
  authMiddleware.requireAuth,
  authMiddleware.requireAdmin,
  async (c) => {
  try {
    const user = (c as any).user;
    const { mergeIds } = await c.req.json();
    
    if (!mergeIds || !Array.isArray(mergeIds)) {
      return c.json({ error: 'Invalid request body. Expected { mergeIds }' }, 400);
    }

    const impact = await authorityMergeIntegrity.analyzeMergeImpact(
      mergeIds,
      user.institutionId
    );
    
    return c.json(impact);
  } catch (error) {
    console.error('[MOON API] Merge analysis error:', error);
    return c.json({ error: 'Failed to analyze merge impact', details: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

// Merge authorities (POST /moon/authorities/merge)
// 🔒 ADMIN ONLY: Merging authorities rewrites references across all records
app.post("/make-server-49c0e13c/moon/authorities/merge",
  authMiddleware.requireAuth,
  authMiddleware.requireAdmin,
  authMiddleware.auditLog,
  async (c) => {
  try {
    const user = (c as any).user;
    const { keepId, mergeIds, tripleStoreConfig } = await c.req.json();
    
    if (!keepId || !mergeIds || !Array.isArray(mergeIds)) {
      return c.json({ error: 'Invalid request body. Expected { keepId, mergeIds, tripleStoreConfig? }' }, 400);
    }

    // ⚠️ CRITICAL: Use new integrity-preserving merge
    console.warn(`[AUTHORITY MERGE] User ${user.email} merging ${mergeIds.join(', ')} into ${keepId}`);
    
    const result = await authorityMergeIntegrity.mergeAuthoritiesWithIntegrity(
      keepId,
      mergeIds,
      user.institutionId,
      user.id,
      tripleStoreConfig
    );
    
    return c.json({
      success: true,
      ...result,
      message: `Merged ${result.recordsUpdated} records with ${result.triplesRewritten} URI replacements`
    });
  } catch (error) {
    console.error('[MOON API] Merge authorities error:', error);
    return c.json({ error: 'Failed to merge authorities', details: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

// Import external authority (POST /moon/authorities/import)
app.post("/make-server-49c0e13c/moon/authorities/import", async (c) => {
  try {
    const { uri, type } = await c.req.json();
    
    if (!uri || !type) {
      return c.json({ error: 'URI and type are required' }, 400);
    }

    const imported = await authorities.importExternalAuthority(uri, type);
    return c.json(imported);
  } catch (error) {
    console.error('[MOON API] Import authority error:', error);
    return c.json({ error: 'Failed to import authority', details: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

// 🗄️ TRIPLE STORE INTEGRATION ENDPOINTS

// Execute SPARQL Query (POST /moon/sparql/query)
// 🔒 PROTECTED: Requires authentication + sparql.read permission
app.post("/make-server-49c0e13c/moon/sparql/query",
  authMiddleware.requireAuth,
  authMiddleware.requirePermission('sparql.read'),
  async (c) => {
  try {
    const { query, config } = await c.req.json();
    
    if (!query || !config) {
      return c.json({ error: 'Query and config are required' }, 400);
    }

    // TODO: Add institution-based graph filtering to SPARQL queries
    // For now, allow read access but log it
    const user = (c as any).user;
    console.log(`[SPARQL] Query executed by ${user.email} from institution ${user.institutionId}`);

    const results = await tripleStore.querySparql(query, config);
    return c.json(results);
  } catch (error) {
    console.error('[MOON API] SPARQL query error:', error);
    return c.json({ error: 'SPARQL query failed', details: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

// Execute SPARQL Update (POST /moon/sparql/update)
// 🔒 ADMIN ONLY: SPARQL UPDATE can modify entire triple store
app.post("/make-server-49c0e13c/moon/sparql/update",
  authMiddleware.requireAuth,
  authMiddleware.requireAdmin,
  authMiddleware.requireSparqlUpdatePermission,
  authMiddleware.auditLog,
  async (c) => {
  try {
    const { query, config } = await c.req.json();
    
    if (!query || !config) {
      return c.json({ error: 'Query and config are required' }, 400);
    }

    // 🚨 CRITICAL: Log all SPARQL UPDATE operations for audit
    const user = (c as any).user;
    console.warn(`[SECURITY AUDIT] SPARQL UPDATE executed by ${user.email} (${user.id})`);
    console.warn(`[SECURITY AUDIT] Query: ${query.substring(0, 200)}...`);

    const result = await tripleStore.updateSparql(query, config);
    return c.json(result);
  } catch (error) {
    console.error('[MOON API] SPARQL update error:', error);
    return c.json({ error: 'SPARQL update failed', details: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

// Upload record to triple store (POST /moon/triplestore/upload/:id)
app.post("/make-server-49c0e13c/moon/triplestore/upload/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const { config } = await c.req.json();
    
    if (!config) {
      return c.json({ error: 'Triple store config is required' }, 400);
    }

    const record = await moonRecords.getMoonRecord(id);
    if (!record) {
      return c.json({ error: 'Record not found' }, 404);
    }

    const result = await tripleStore.syncRecordToTripleStore(id, record.document, config);
    return c.json(result);
  } catch (error) {
    console.error('[MOON API] Upload to triple store error:', error);
    return c.json({ error: 'Upload failed', details: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

// Get example triple store configurations
app.get("/make-server-49c0e13c/moon/triplestore/examples", async (c) => {
  return c.json({
    fuseki: tripleStore.EXAMPLE_FUSEKI_CONFIG,
    blazegraph: tripleStore.EXAMPLE_BLAZEGRAPH_CONFIG,
    graphdb: tripleStore.EXAMPLE_GRAPHDB_CONFIG,
    exampleQueries: tripleStore.EXAMPLE_QUERIES
  });
});

// 🕰️ VERSIONING & AUDIT ENDPOINTS

// Get version history (GET /moon/versions/:entityType/:entityId)
app.get("/make-server-49c0e13c/moon/versions/:entityType/:entityId", async (c) => {
  try {
    const entityType = c.req.param('entityType') as 'record' | 'authority';
    const entityId = c.req.param('entityId');

    const history = await versioning.getVersionHistory(entityId, entityType);
    return c.json({ history, count: history.length });
  } catch (error) {
    console.error('[MOON API] Get version history error:', error);
    return c.json({ error: 'Failed to get version history' }, 500);
  }
});

// Get specific version (GET /moon/versions/:entityType/:entityId/:version)
app.get("/make-server-49c0e13c/moon/versions/:entityType/:entityId/:version", async (c) => {
  try {
    const entityType = c.req.param('entityType') as 'record' | 'authority';
    const entityId = c.req.param('entityId');
    const version = parseInt(c.req.param('version'));

    const versionData = await versioning.getVersion(entityId, entityType, version);
    
    if (!versionData) {
      return c.json({ error: 'Version not found' }, 404);
    }

    return c.json(versionData);
  } catch (error) {
    console.error('[MOON API] Get version error:', error);
    return c.json({ error: 'Failed to get version' }, 500);
  }
});

// Rollback to version (POST /moon/versions/:entityType/:entityId/rollback)
app.post("/make-server-49c0e13c/moon/versions/:entityType/:entityId/rollback", async (c) => {
  try {
    const entityType = c.req.param('entityType') as 'record' | 'authority';
    const entityId = c.req.param('entityId');
    const { targetVersion, actor, reason } = await c.req.json();

    if (!targetVersion || !actor || !reason) {
      return c.json({ error: 'targetVersion, actor, and reason are required' }, 400);
    }

    const result = await versioning.rollbackToVersion(
      entityId,
      entityType,
      targetVersion,
      actor,
      reason
    );

    if (!result) {
      return c.json({ error: 'Rollback failed' }, 500);
    }

    return c.json(result);
  } catch (error) {
    console.error('[MOON API] Rollback error:', error);
    return c.json({ error: 'Rollback failed', details: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

// Soft delete (POST /moon/:entityType/:entityId/delete)
app.post("/make-server-49c0e13c/moon/:entityType/:entityId/delete", async (c) => {
  try {
    const entityType = c.req.param('entityType') as 'record' | 'authority';
    const entityId = c.req.param('entityId');
    // Deleting and restoring records or authorities is the Super Admin's job.
    if (!(await isAdminSession(c))) {
      return c.json({ error: 'Super Admin session required' }, 403);
    }
    const { actor, reason } = await c.req.json();

    if (!actor || !reason) {
      return c.json({ error: 'actor and reason are required' }, 400);
    }

    const success = await versioning.softDelete(entityId, entityType, actor, reason);

    if (!success) {
      return c.json({ error: 'Delete failed' }, 500);
    }

    return c.json({ success: true, message: 'Entity soft deleted' });
  } catch (error) {
    console.error('[MOON API] Soft delete error:', error);
    return c.json({ error: 'Delete failed' }, 500);
  }
});

// Restore deleted entity (POST /moon/:entityType/:entityId/restore)
app.post("/make-server-49c0e13c/moon/:entityType/:entityId/restore", async (c) => {
  try {
    const entityType = c.req.param('entityType') as 'record' | 'authority';
    const entityId = c.req.param('entityId');
    if (!(await isAdminSession(c))) {
      return c.json({ error: 'Super Admin session required' }, 403);
    }
    const { actor } = await c.req.json();

    if (!actor) {
      return c.json({ error: 'actor is required' }, 400);
    }

    const success = await versioning.restore(entityId, entityType, actor);

    if (!success) {
      return c.json({ error: 'Restore failed' }, 500);
    }

    return c.json({ success: true, message: 'Entity restored' });
  } catch (error) {
    console.error('[MOON API] Restore error:', error);
    return c.json({ error: 'Restore failed' }, 500);
  }
});

// 📐 SHACL VALIDATION ENDPOINTS

// Get BIBFRAME SHACL shapes (GET /moon/shacl/shapes)
app.get("/make-server-49c0e13c/moon/shacl/shapes", async (c) => {
  const format = c.req.query('format') || 'jsonld';
  
  if (format === 'turtle') {
    return c.text(getSHACLShapesAsTurtle(), 200, { 'Content-Type': 'text/turtle' });
  } else {
    return c.json(BIBFRAME_SHAPES, 200, { 'Content-Type': 'application/ld+json' });
  }
});

// 🔍 DISCOVERY LAYER ENDPOINTS

// Faceted discovery search (POST /moon/discover)
app.post("/make-server-49c0e13c/moon/discover", async (c) => {
  try {
    const query = await c.req.json();
    const results = await discovery.discover(query);
    return c.json(results);
  } catch (error) {
    console.error('[MOON API] Discovery search error:', error);
    return c.json({ error: 'Discovery search failed' }, 500);
  }
});

// 📥 Import external discovery record to local catalog (POST /moon/discovery/import)
app.post("/make-server-49c0e13c/moon/discovery/import", async (c) => {
  try {
    const record = await c.req.json();
    if (!record?.id || !record?.document) {
      return c.json({ error: 'Record must have id and document' }, 400);
    }
    const imported = await importToLocal(record);
    return c.json({ success: true, record: imported });
  } catch (error) {
    console.error('[MOON API] Discovery import error:', error);
    return c.json({ error: 'Failed to import record to local catalog' }, 500);
  }
});

// 📋 Discovery sources metadata (GET /moon/discovery/sources)
app.get("/make-server-49c0e13c/moon/discovery/sources", async (c) => {
  try {
    const sources = getSourceMetadata();
    return c.json({ sources });
  } catch (error) {
    console.error('[MOON API] Discovery sources error:', error);
    return c.json({ error: 'Failed to get sources' }, 500);
  }
});

// Browse by entity (GET /moon/browse/:entityType/:entityUri)
app.get("/make-server-49c0e13c/moon/browse/:entityType/:entityUri", async (c) => {
  try {
    const entityType = c.req.param('entityType') as 'agent' | 'subject' | 'language' | 'place';
    const entityUri = decodeURIComponent(c.req.param('entityUri'));

    const results = await discovery.browseByEntity(entityType, entityUri);
    return c.json({ results, count: results.length });
  } catch (error) {
    console.error('[MOON API] Browse by entity error:', error);
    return c.json({ error: 'Browse failed' }, 500);
  }
});

// Get work cluster (GET /moon/cluster/work/:workUri)
app.get("/make-server-49c0e13c/moon/cluster/work/:workUri", async (c) => {
  try {
    const workUri = decodeURIComponent(c.req.param('workUri'));
    const cluster = await discovery.getWorkCluster(workUri);
    return c.json(cluster);
  } catch (error) {
    console.error('[MOON API] Get work cluster error:', error);
    return c.json({ error: 'Failed to get work cluster' }, 500);
  }
});

// Get authority page (GET /moon/authority-page/:authorityUri)
app.get("/make-server-49c0e13c/moon/authority-page/:authorityUri", async (c) => {
  try {
    const authorityUri = decodeURIComponent(c.req.param('authorityUri'));
    const page = await discovery.getAuthorityPage(authorityUri);
    return c.json(page);
  } catch (error) {
    console.error('[MOON API] Get authority page error:', error);
    return c.json({ error: 'Failed to get authority page' }, 500);
  }
});

// 🏛️ MULTI-TENANT ENDPOINTS

// Create institution (POST /moon/institutions)
app.post("/make-server-49c0e13c/moon/institutions", async (c) => {
  try {
    if (!(await isAdminSession(c))) {
      return c.json({ error: 'Super Admin session required' }, 403);
    }
    const data = await c.req.json();
    const institution = await multiTenant.createInstitution(data);
    return c.json(institution);
  } catch (error) {
    console.error('[MOON API] Create institution error:', error);
    return c.json({ error: 'Failed to create institution' }, 500);
  }
});

// Get institution (GET /moon/institutions/:id)
app.get("/make-server-49c0e13c/moon/institutions/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const institution = await multiTenant.getInstitution(id);
    
    if (!institution) {
      return c.json({ error: 'Institution not found' }, 404);
    }

    return c.json(institution);
  } catch (error) {
    console.error('[MOON API] Get institution error:', error);
    return c.json({ error: 'Failed to get institution' }, 500);
  }
});

// List institutions (GET /moon/institutions)
app.get("/make-server-49c0e13c/moon/institutions", async (c) => {
  try {
    const institutions = await multiTenant.listInstitutions();
    return c.json({ institutions, count: institutions.length });
  } catch (error) {
    console.error('[MOON API] List institutions error:', error);
    return c.json({ error: 'Failed to list institutions' }, 500);
  }
});

// Get institution statistics (GET /moon/institutions/:id/stats)
app.get("/make-server-49c0e13c/moon/institutions/:id/stats", async (c) => {
  try {
    const id = c.req.param('id');
    const stats = await multiTenant.getInstitutionStats(id);
    return c.json(stats);
  } catch (error) {
    console.error('[MOON API] Get institution stats error:', error);
    return c.json({ error: 'Failed to get institution stats' }, 500);
  }
});

// Create user (POST /moon/users)
app.post("/make-server-49c0e13c/moon/users", async (c) => {
  try {
    // A Moon user's roles decide what the /moon/* routes allow (admin included): only the Super Admin creates them.
    if (!(await isAdminSession(c))) {
      return c.json({ error: 'Super Admin session required' }, 403);
    }
    const data = await c.req.json();
    const user = await multiTenant.createUser(data);
    return c.json(user);
  } catch (error) {
    console.error('[MOON API] Create user error:', error);
    return c.json({ error: 'Failed to create user' }, 500);
  }
});

// Get user (GET /moon/users/:id)
app.get("/make-server-49c0e13c/moon/users/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const user = await multiTenant.getUser(id);
    
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json(user);
  } catch (error) {
    console.error('[MOON API] Get user error:', error);
    return c.json({ error: 'Failed to get user' }, 500);
  }
});

// 🔐 JWT AUTHENTICATION ENDPOINTS

// Token refresh (POST /auth/refresh)
app.post("/make-server-49c0e13c/auth/refresh", async (c) => {
  try {
    const { refresh_token } = await c.req.json();
    
    if (!refresh_token) {
      return c.json({ error: 'refresh_token required' }, 400);
    }

    const result = await jwtAuth.refreshToken(refresh_token);
    
    if (!result.success) {
      return c.json({ error: result.error }, 401);
    }

    return c.json({
      access_token: result.accessToken,
      expires_at: result.expiresAt
    });
  } catch (error) {
    console.error('[AUTH] Token refresh error:', error);
    return c.json({ error: 'Token refresh failed' }, 500);
  }
});

// OAuth initiation (GET /auth/oauth/:provider)
app.get("/make-server-49c0e13c/auth/oauth/:provider", async (c) => {
  try {
    const provider = c.req.param('provider') as 'google' | 'github' | 'azure';
    
    if (!['google', 'github', 'azure'].includes(provider)) {
      return c.json({ error: 'Invalid provider. Supported: google, github, azure' }, 400);
    }

    const result = await jwtAuth.initiateOAuth(provider);
    
    if (!result.success) {
      return c.json({ error: result.error }, 500);
    }

    // Redirect to OAuth provider
    return c.redirect(result.url!);
  } catch (error) {
    console.error('[AUTH] OAuth initiation error:', error);
    return c.json({ error: 'OAuth initiation failed' }, 500);
  }
});

// Token inspection (POST /auth/inspect)
app.post("/make-server-49c0e13c/auth/inspect", async (c) => {
  try {
    const { token } = await c.req.json();
    
    if (!token) {
      return c.json({ error: 'token required' }, 400);
    }

    const result = jwtAuth.inspectToken(token);
    return c.json(result);
  } catch (error) {
    console.error('[AUTH] Token inspection error:', error);
    return c.json({ error: 'Token inspection failed' }, 500);
  }
});

// 📊 OBSERVABILITY & MONITORING ENDPOINTS

// Get system health (GET /health)
app.get("/make-server-49c0e13c/health", async (c) => {
  try {
    const health = await observability.getSystemHealth();
    return c.json(health);
  } catch (error) {
    console.error('[HEALTH] Health check error:', error);
    return c.json({
      status: 'critical',
      error: 'Failed to retrieve health status'
    }, 500);
  }
});

// Get audit logs (GET /admin/audit)
app.get("/make-server-49c0e13c/admin/audit",
  authMiddleware.requireAuth,
  authMiddleware.requireAdmin,
  async (c) => {
  try {
    const user = (c as any).user;
    const userId = c.req.query('userId');
    const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : 100;

    const logs = await observability.getAuditLogs(user.institutionId, {
      userId,
      limit
    });

    return c.json({ logs, count: logs.length });
  } catch (error) {
    console.error('[ADMIN] Audit log query error:', error);
    return c.json({ error: 'Failed to retrieve audit logs' }, 500);
  }
});

// Get error logs (GET /admin/errors)
app.get("/make-server-49c0e13c/admin/errors",
  authMiddleware.requireAuth,
  authMiddleware.requireAdmin,
  async (c) => {
  try {
    const severity = c.req.query('severity') as 'low' | 'medium' | 'high' | 'critical' | undefined;
    const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : 100;

    const errors = await observability.getErrorLogs(severity, limit);

    return c.json({ errors, count: errors.length });
  } catch (error) {
    console.error('[ADMIN] Error log query error:', error);
    return c.json({ error: 'Failed to retrieve error logs' }, 500);
  }
});

// Get performance metrics (GET /admin/metrics)
app.get("/make-server-49c0e13c/admin/metrics",
  authMiddleware.requireAuth,
  authMiddleware.requireAdmin,
  async (c) => {
  try {
    const operation = c.req.query('operation');
    const metrics = await observability.getPerformanceMetrics(operation);

    // Calculate statistics
    const avgDuration = metrics.length > 0
      ? metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length
      : 0;
    
    const successRate = metrics.length > 0
      ? (metrics.filter(m => m.success).length / metrics.length) * 100
      : 0;

    return c.json({
      metrics,
      count: metrics.length,
      statistics: {
        avgDuration,
        successRate,
        totalOperations: metrics.length
      }
    });
  } catch (error) {
    console.error('[ADMIN] Metrics query error:', error);
    return c.json({ error: 'Failed to retrieve metrics' }, 500);
  }
});

// 🧪 LOAD TESTING ENDPOINTS (Development Only)

// Generate test records (POST /test/generate-records)
app.post("/make-server-49c0e13c/test/generate-records",
  authMiddleware.requireAuth,
  authMiddleware.requireAdmin,
  async (c) => {
  try {
    const user = (c as any).user;
    const { count } = await c.req.json();

    if (!count || count < 1 || count > 10000) {
      return c.json({ error: 'Count must be between 1 and 10000' }, 400);
    }

    console.log(`[LOAD TEST] Generating ${count} test records...`);

    const result = await loadTesting.generateTestRecords(
      user.institutionId,
      user.id,
      count
    );

    return c.json(result);
  } catch (error) {
    console.error('[LOAD TEST] Generate records error:', error);
    return c.json({ error: 'Failed to generate test records' }, 500);
  }
});

// Benchmark list operation (POST /test/benchmark/list)
app.post("/make-server-49c0e13c/test/benchmark/list",
  authMiddleware.requireAuth,
  authMiddleware.requireAdmin,
  async (c) => {
  try {
    const user = (c as any).user;
    const { limit } = await c.req.json();

    const result = await loadTesting.benchmarkListOperation(
      user.institutionId,
      limit
    );

    return c.json(result);
  } catch (error) {
    console.error('[LOAD TEST] Benchmark list error:', error);
    return c.json({ error: 'Benchmark failed' }, 500);
  }
});

// Benchmark search operation (POST /test/benchmark/search)
app.post("/make-server-49c0e13c/test/benchmark/search",
  authMiddleware.requireAuth,
  authMiddleware.requireAdmin,
  async (c) => {
  try {
    const user = (c as any).user;
    const { query } = await c.req.json();

    if (!query) {
      return c.json({ error: 'Query required' }, 400);
    }

    const result = await loadTesting.benchmarkSearchOperation(
      user.institutionId,
      query
    );

    return c.json(result);
  } catch (error) {
    console.error('[LOAD TEST] Benchmark search error:', error);
    return c.json({ error: 'Benchmark failed' }, 500);
  }
});

// Stress test concurrent reads (POST /test/stress/concurrent-reads)
app.post("/make-server-49c0e13c/test/stress/concurrent-reads",
  authMiddleware.requireAuth,
  authMiddleware.requireAdmin,
  async (c) => {
  try {
    const user = (c as any).user;
    const { recordId, concurrency } = await c.req.json();

    if (!recordId || !concurrency) {
      return c.json({ error: 'recordId and concurrency required' }, 400);
    }

    if (concurrency > 100) {
      return c.json({ error: 'Concurrency limited to 100' }, 400);
    }

    const result = await loadTesting.stressTestConcurrentReads(
      user.institutionId,
      concurrency,
      recordId
    );

    return c.json(result);
  } catch (error) {
    console.error('[LOAD TEST] Stress test error:', error);
    return c.json({ error: 'Stress test failed' }, 500);
  }
});

// Cleanup test records (DELETE /test/cleanup)
app.delete("/make-server-49c0e13c/test/cleanup",
  authMiddleware.requireAuth,
  authMiddleware.requireAdmin,
  async (c) => {
  try {
    const user = (c as any).user;
    const { recordIds } = await c.req.json();

    if (!recordIds || !Array.isArray(recordIds)) {
      return c.json({ error: 'recordIds array required' }, 400);
    }

    const result = await loadTesting.cleanupTestRecords(
      user.institutionId,
      recordIds
    );

    return c.json(result);
  } catch (error) {
    console.error('[LOAD TEST] Cleanup error:', error);
    return c.json({ error: 'Cleanup failed' }, 500);
  }
});

// ═══════════════════════════════════════════════════════════
// 📚 RECORD LIFECYCLE API (V2)
// ═══════════════════════════════════════════════════════════
app.route('/make-server-49c0e13c', recordRoutes);
app.route('/make-server-49c0e13c', accountRoutes);

// ═══════════════════════════════════════════════════════════
// 🌐 OPEN LINKED DATA — Content Negotiation & Public Endpoints
// ═══════════════════════════════════════════════════════════

import { toTurtle as rdfToTurtle } from "./rdfExporter.tsx";
import { getInternalRecords, getSourceMetadata, importToLocal } from "./discoveryProviders.tsx";

// Helper: resolve a record from ANY storage system
async function resolveRecordById(id: string): Promise<{ record: any; document: any } | null> {
  // Try moon:record: prefix first
  let recordStr = await kv.get(`moon:record:${id}`);
  if (recordStr) {
    const record = typeof recordStr === 'string' ? JSON.parse(recordStr) : recordStr;
    return { record, document: record.document || record };
  }
  // Try record: prefix (recordService format — key is record:bibframe:record:<uuid>)
  recordStr = await kv.get(`record:${id}`);
  if (recordStr) {
    const record = typeof recordStr === 'string' ? JSON.parse(recordStr) : recordStr;
    return { record, document: record.graphJson || record.document || record };
  }
  // Try bibframe:record: prefix (inline routes format)
  recordStr = await kv.get(`bibframe:record:${id}`);
  if (recordStr) {
    const record = typeof recordStr === 'string' ? JSON.parse(recordStr) : recordStr;
    return { record, document: record.document || record };
  }
  // Try moon-engine:record: prefix
  recordStr = await kv.get(`moon-engine:record:${id}`);
  if (recordStr) {
    const record = typeof recordStr === 'string' ? JSON.parse(recordStr) : recordStr;
    return { record, document: record.document || record };
  }
  return null;
}

// Public resource endpoint with full content negotiation
app.get("/make-server-49c0e13c/ld/resource/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const accept = c.req.header('Accept') || 'application/json';
    const resolved = await resolveRecordById(id);
    if (!resolved) return c.json({ error: 'Resource not found', uri: id }, 404);
    const { record, document } = resolved;
    if (accept.includes('text/turtle')) {
      const turtle = rdfToTurtle(document);
      return c.text(turtle, 200, { 'Content-Type': 'text/turtle; charset=utf-8' });
    }
    if (accept.includes('application/ld+json')) {
      return c.json(document, 200, { 'Content-Type': 'application/ld+json; charset=utf-8' });
    }
    if (accept.includes('application/n-triples')) {
      const graph = document['@graph'] || [document];
      const triples: string[] = [];
      for (const node of graph) {
        if (!node['@id']) continue;
        const subject = `<${node['@id']}>`;
        if (node['@type']) {
          const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
          for (const t of types) {
            triples.push(`${subject} <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <${t.startsWith('bf:') ? 'http://id.loc.gov/ontologies/bibframe/' + t.slice(3) : t}> .`);
          }
        }
        for (const [key, val] of Object.entries(node)) {
          if (key.startsWith('@')) continue;
          const predUri = key.startsWith('bf:') ? 'http://id.loc.gov/ontologies/bibframe/' + key.slice(3) : key;
          if (typeof val === 'object' && val !== null && (val as any)['@id']) {
            triples.push(`${subject} <${predUri}> <${(val as any)['@id']}> .`);
          } else if (typeof val === 'string') {
            triples.push(`${subject} <${predUri}> "${val.replace(/"/g, '\\"')}" .`);
          }
        }
      }
      return c.text(triples.join('\n'), 200, { 'Content-Type': 'application/n-triples; charset=utf-8' });
    }
    return c.json({
      '@context': document['@context'], '@graph': document['@graph'],
      _meta: { id: record.id, title: record.title, status: record.status || 'published',
        uri: `https://moonlib.org/resource/${id}`,
        contentNegotiation: { 'application/ld+json': `/ld/resource/${id}`, 'text/turtle': `/ld/resource/${id}`, 'application/n-triples': `/ld/resource/${id}` },
        createdAt: record.createdAt, updatedAt: record.updatedAt }
    });
  } catch (error) {
    console.error('[LD] Resource resolution error:', error);
    return c.json({ error: 'Failed to resolve resource' }, 500);
  }
});

app.get("/make-server-49c0e13c/ld/resource/:id/jsonld", async (c) => {
  try {
    const id = c.req.param('id');
    const resolved = await resolveRecordById(id);
    if (!resolved) return c.json({ error: 'Not found' }, 404);
    return c.json(resolved.document, 200, { 'Content-Type': 'application/ld+json; charset=utf-8' });
  } catch (error) { console.error('[LD] JSON-LD export error:', error); return c.json({ error: 'Export failed' }, 500); }
});

app.get("/make-server-49c0e13c/ld/resource/:id/turtle", async (c) => {
  try {
    const id = c.req.param('id');
    const resolved = await resolveRecordById(id);
    if (!resolved) return c.json({ error: 'Not found' }, 404);
    const turtle = rdfToTurtle(resolved.document);
    return c.text(turtle, 200, { 'Content-Type': 'text/turtle; charset=utf-8' });
  } catch (error) { console.error('[LD] Turtle export error:', error); return c.json({ error: 'Export failed' }, 500); }
});

app.get("/make-server-49c0e13c/ld/resource/:id/ntriples", async (c) => {
  try {
    const id = c.req.param('id');
    const resolved = await resolveRecordById(id);
    if (!resolved) return c.json({ error: 'Not found' }, 404);
    const document = resolved.document;
    const graph = document['@graph'] || [document];
    const triples: string[] = [];
    for (const node of graph) {
      if (!node['@id']) continue;
      const subject = `<${node['@id']}>`;
      if (node['@type']) {
        const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
        for (const t of types) {
          triples.push(`${subject} <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <${t.startsWith('bf:') ? 'http://id.loc.gov/ontologies/bibframe/' + t.slice(3) : t}> .`);
        }
      }
      for (const [key, val] of Object.entries(node)) {
        if (key.startsWith('@')) continue;
        const predUri = key.startsWith('bf:') ? 'http://id.loc.gov/ontologies/bibframe/' + key.slice(3) : key;
        if (typeof val === 'object' && val !== null && (val as any)['@id']) {
          triples.push(`${subject} <${predUri}> <${(val as any)['@id']}> .`);
        } else if (typeof val === 'string') {
          triples.push(`${subject} <${predUri}> "${val.replace(/"/g, '\\"')}" .`);
        }
      }
    }
    return c.text(triples.join('\n'), 200, { 'Content-Type': 'application/n-triples; charset=utf-8' });
  } catch (error) { console.error('[LD] N-Triples export error:', error); return c.json({ error: 'Export failed' }, 500); }
});

// Discovery source metadata
app.get("/make-server-49c0e13c/ld/sources", async (c) => {
  return c.json({ sources: getSourceMetadata() });
});

app.get("/make-server-49c0e13c/ld/subjects/:uri", async (c) => {
  try {
    const uri = decodeURIComponent(c.req.param('uri'));
    const hierarchy = await discovery.getSubjectHierarchy(uri);
    return c.json(hierarchy);
  } catch (error) { console.error('[LD] Subject hierarchy error:', error); return c.json({ error: 'Failed' }, 500); }
});

app.get("/make-server-49c0e13c/ld/stats", async (c) => {
  try {
    // Use the centralized provider to get all internal records
    const normalizedRecords = await getInternalRecords();

    const stats = { totalRecords: normalizedRecords.length, works: 0, instances: 0, items: 0,
      languages: new Set<string>(), contributors: new Set<string>(), subjects: new Set<string>() };
    for (const rec of normalizedRecords) {
      const doc = rec.document;
      if (!doc?.['@graph']) continue;
      for (const node of doc['@graph']) {
        if (!node) continue;
        const types = Array.isArray(node['@type']) ? node['@type'] : (node['@type'] ? [node['@type']] : []);
        if (types.some((t: string) => t?.includes('Work'))) stats.works++;
        if (types.some((t: string) => t?.includes('Instance'))) stats.instances++;
        if (types.some((t: string) => t?.includes('Item'))) stats.items++;
        const lang = node['bf:language'] || node['http://id.loc.gov/ontologies/bibframe/language'];
        if (lang) stats.languages.add(typeof lang === 'object' ? lang['@id'] : lang);
        if (types.some((t: string) => t?.includes('Contribution'))) {
          const agent = node['bf:agent'] || node['http://id.loc.gov/ontologies/bibframe/agent'];
          if (agent) stats.contributors.add(typeof agent === 'object' ? (agent['rdfs:label'] || agent['@id']) : agent);
        }
        const subj = node['bf:subject'] || node['http://id.loc.gov/ontologies/bibframe/subject'];
        if (subj) stats.subjects.add(typeof subj === 'object' ? (subj['rdfs:label'] || subj['@id']) : subj);
      }
    }
    return c.json({ totalRecords: stats.totalRecords, works: stats.works, instances: stats.instances,
      items: stats.items, uniqueLanguages: stats.languages.size, uniqueContributors: stats.contributors.size,
      uniqueSubjects: stats.subjects.size, sources: getSourceMetadata() });
  } catch (error) { console.error('[LD] Stats error:', error); return c.json({ error: 'Failed' }, 500); }
});

// ============================== SCRIPTSHIFTER PROXY ==============================
// Proxies requests to LC ScriptShifter API to bypass CORS restrictions
// https://github.com/lcnetdev/scriptshifter

const SS_UPSTREAM = "https://bibframe.org/scriptshifter";

app.get("/make-server-49c0e13c/scriptshifter/languages", async (c) => {
  try {
    console.log("[ScriptShifter] Fetching languages from LC API...");
    const resp = await fetch(`${SS_UPSTREAM}/languages`, {
      headers: { "Accept": "application/json" },
    });
    if (!resp.ok) {
      console.log(`[ScriptShifter] LC API returned ${resp.status}`);
      return c.json({ error: `LC API returned ${resp.status}` }, resp.status as any);
    }
    const data = await resp.json();
    console.log(`[ScriptShifter] Loaded ${Object.keys(data).length} languages`);
    return c.json(data);
  } catch (error: any) {
    console.error("[ScriptShifter] Failed to fetch languages:", error.message);
    return c.json({ error: `Failed to fetch languages: ${error.message}` }, 502);
  }
});

app.get("/make-server-49c0e13c/scriptshifter/options/:lang", async (c) => {
  const lang = c.req.param("lang");
  try {
    const resp = await fetch(`${SS_UPSTREAM}/options/${encodeURIComponent(lang)}`, {
      headers: { "Accept": "application/json" },
    });
    if (!resp.ok) return c.json({ error: `LC API returned ${resp.status}` }, resp.status as any);
    return c.json(await resp.json());
  } catch (error: any) {
    console.error(`[ScriptShifter] Options error for ${lang}:`, error.message);
    return c.json({ error: error.message }, 502);
  }
});

app.post("/make-server-49c0e13c/scriptshifter/trans", async (c) => {
  try {
    const body = await c.req.json();
    console.log(`[ScriptShifter] Transliterating: lang=${body.lang}, dir=${body.t_dir}, len=${body.text?.length}`);
    const resp = await fetch(`${SS_UPSTREAM}/trans`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await resp.json();
    if (!resp.ok) {
      console.log(`[ScriptShifter] Translation error ${resp.status}:`, JSON.stringify(data));
      return c.json(data, resp.status as any);
    }
    console.log(`[ScriptShifter] Success: output length=${data.output?.length}, warnings=${data.warnings?.length || 0}`);
    return c.json(data);
  } catch (error: any) {
    console.error("[ScriptShifter] Translation proxy error:", error.message);
    return c.json({ error: `Translation proxy error: ${error.message}`, warnings: [`Proxy error: ${error.message}`], output: "" }, 502);
  }
});

// ═══════════════════════════════════════════════════════════
// 🧠 ENTERPRISE AI ENGINE — BIBFRAME AI Layer (Level 3)
// ═══════════════════════════════════════════════════════════

// AI Debug: Check OPENAI_API_KEY status (env only — enterprise pattern)
app.get("/make-server-49c0e13c/ai/debug-key", async (c) => {
  const envKey = Deno.env.get("OPENAI_API_KEY");
  const valid = !!envKey && envKey.trim().length >= 20;
  console.log(`[AI DEBUG] ENV key exists=${!!envKey}, length=${envKey?.length ?? 0}, valid=${valid}`);
  return c.json({
    configured: valid,
    keyLength: envKey?.length || 0,
    keyPrefix: envKey ? envKey.slice(0, 7) + "..." : "NOT SET",
    status: valid ? "READY" : `INVALID (${envKey?.length ?? 0} chars — expected 50+)`,
  });
});

// Phase 1: AI Metadata Suggestions
app.post("/make-server-49c0e13c/ai/suggest-metadata", async (c) => {
  try {
    const input = await c.req.json();
    console.log("[AI] Phase 1: Metadata suggestion request", Object.keys(input));
    const result = await aiEngine.suggestMetadata(input);
    return c.json(result);
  } catch (error: any) {
    console.error("[AI] Phase 1 error:", error.message);
    return c.json({ error: `AI metadata suggestion error: ${error.message}` }, 500);
  }
});

// Phase 2: AI Duplicate Detection
app.post("/make-server-49c0e13c/ai/detect-duplicates", async (c) => {
  try {
    const input = await c.req.json();
    console.log("[AI] Phase 2: Duplicate detection request", input.title);
    const result = await aiEngine.detectDuplicates(input);
    return c.json({ candidates: result });
  } catch (error: any) {
    console.error("[AI] Phase 2 error:", error.message);
    return c.json({ error: `AI duplicate detection error: ${error.message}` }, 500);
  }
});

// Phase 3: AI Natural Language Discovery
app.post("/make-server-49c0e13c/ai/natural-search", async (c) => {
  try {
    const { query } = await c.req.json();
    if (!query) return c.json({ error: "query parameter required" }, 400);
    console.log("[AI] Phase 3: Natural language search", query);
    const result = await aiEngine.naturalLanguageSearch(query);
    return c.json(result);
  } catch (error: any) {
    console.error("[AI] Phase 3 error:", error.message);
    return c.json({ error: `AI natural search error: ${error.message}` }, 500);
  }
});

// Phase 4: AI SPARQL Translator
app.post("/make-server-49c0e13c/ai/sparql-translate", async (c) => {
  try {
    const { query } = await c.req.json();
    if (!query) return c.json({ error: "query parameter required" }, 400);
    console.log("[AI] Phase 4: SPARQL translation", query);
    const result = await aiEngine.translateToSPARQL(query);
    return c.json(result);
  } catch (error: any) {
    console.error("[AI] Phase 4 error:", error.message);
    return c.json({ error: `AI SPARQL translation error: ${error.message}` }, 500);
  }
});

// Phase 5: AI Auto Fill
app.post("/make-server-49c0e13c/ai/autofill", async (c) => {
  try {
    const input = await c.req.json();
    console.log("[AI] Phase 5: Auto-fill request", input);
    const result = await aiEngine.autoFill(input);
    return c.json(result);
  } catch (error: any) {
    console.error("[AI] Phase 5 error:", error.message);
    return c.json({ error: `AI auto-fill error: ${error.message}` }, 500);
  }
});

// AI Audit Log
app.get("/make-server-49c0e13c/ai/audit-log", async (c) => {
  try {
    const limit = parseInt(c.req.query("limit") || "50");
    const entries = await aiEngine.getAuditLog(limit);
    return c.json({ entries, count: entries.length });
  } catch (error: any) {
    console.error("[AI] Audit log error:", error.message);
    return c.json({ error: `AI audit log error: ${error.message}` }, 500);
  }
});

// AI Audit Approval/Rejection
app.post("/make-server-49c0e13c/ai/audit/:id/approve", async (c) => {
  try {
    const id = c.req.param("id");
    const { approved } = await c.req.json();
    await aiEngine.updateAuditApproval(id, approved);
    return c.json({ success: true, id, approved });
  } catch (error: any) {
    console.error("[AI] Audit approval error:", error.message);
    return c.json({ error: `AI audit approval error: ${error.message}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════
// ⭐ FAVORITE TOOLS PERSISTENCE
// ═══════════════════════════════════════════════════════════

// 📥 Get User Favorites
app.get("/make-server-49c0e13c/favorites", async (c) => {
  try {
    // Get session ID from query or use default
    const sessionId = c.req.query('sessionId') || 'default-user';
    const key = `user:favorites:${sessionId}`;
    
    const favorites = await kv.get(key);
    console.log(`[FAVORITES] Loaded favorites for ${sessionId}:`, favorites);
    
    return c.json({ 
      favorites: favorites || [], 
      sessionId 
    });
  } catch (error: any) {
    console.error("[FAVORITES] Load error:", error.message);
    return c.json({ error: `Failed to load favorites: ${error.message}` }, 500);
  }
});

// 💾 Save User Favorites
app.post("/make-server-49c0e13c/favorites", async (c) => {
  try {
    const { sessionId, favorites } = await c.req.json();
    
    if (!favorites || !Array.isArray(favorites)) {
      return c.json({ error: 'Favorites array required' }, 400);
    }
    
    const userId = sessionId || 'default-user';
    const key = `user:favorites:${userId}`;
    
    await kv.set(key, favorites);
    console.log(`[FAVORITES] Saved ${favorites.length} favorites for ${userId}`);
    
    return c.json({ 
      success: true, 
      sessionId: userId,
      count: favorites.length 
    });
  } catch (error: any) {
    console.error("[FAVORITES] Save error:", error.message);
    return c.json({ error: `Failed to save favorites: ${error.message}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════
// MULTI-AI ROUTING ENGINE (MOON DIJLA)
// ═══════════════════════════════════════════════════════════

// AI Router: Provider Status
app.get("/make-server-49c0e13c/ai-router/status", (c) => {
  try {
    const providers = aiRouter.getProviderStatus();
    const config = aiRouter.getRouterConfig();
    return c.json({ providers, config, timestamp: new Date().toISOString() });
  } catch (error: any) {
    console.error("[AI-ROUTER] Status error:", error.message);
    return c.json({ error: `AI router status error: ${error.message}` }, 500);
  }
});

// AI Router: Routing Log
app.get("/make-server-49c0e13c/ai-router/routing-log", async (c) => {
  try {
    const limit = parseInt(c.req.query("limit") || "50");
    const log = await aiRouter.getRoutingLog(limit);
    return c.json({ log, count: log.length });
  } catch (error: any) {
    console.error("[AI-ROUTER] Routing log error:", error.message);
    return c.json({ error: `Routing log error: ${error.message}` }, 500);
  }
});

// AI Router: Update Configuration
app.post("/make-server-49c0e13c/ai-router/config", async (c) => {
  try {
    const updates = await c.req.json();
    const config = aiRouter.updateRouterConfig(updates);
    return c.json({ success: true, config });
  } catch (error: any) {
    console.error("[AI-ROUTER] Config update error:", error.message);
    return c.json({ error: `Config update error: ${error.message}` }, 500);
  }
});

// AI Router: Routed Metadata Suggestions
app.post("/make-server-49c0e13c/ai-router/suggest-metadata", async (c) => {
  try {
    const input = await c.req.json();
    console.log("[AI-ROUTER] Routed metadata suggestion", Object.keys(input));
    const result = await aiRouter.routedSuggestMetadata(input);
    return c.json(result);
  } catch (error: any) {
    console.error("[AI-ROUTER] Metadata error:", error.message);
    return c.json({ error: `AI router metadata error: ${error.message}` }, 500);
  }
});

// AI Router: Routed Entity Linking
app.post("/make-server-49c0e13c/ai-router/entity-linking", async (c) => {
  try {
    const input = await c.req.json();
    console.log("[AI-ROUTER] Routed entity linking", input.entityName);
    const result = await aiRouter.routedEntityLinking(input);
    return c.json(result);
  } catch (error: any) {
    console.error("[AI-ROUTER] Entity linking error:", error.message);
    return c.json({ error: `AI router entity linking error: ${error.message}` }, 500);
  }
});

// AI Router: Routed Duplicate Detection
app.post("/make-server-49c0e13c/ai-router/detect-duplicates", async (c) => {
  try {
    const input = await c.req.json();
    console.log("[AI-ROUTER] Routed duplicate detection", input.title);
    const result = await aiRouter.routedDuplicateDetection(input);
    return c.json(result);
  } catch (error: any) {
    console.error("[AI-ROUTER] Duplicate detection error:", error.message);
    return c.json({ error: `AI router duplicate error: ${error.message}` }, 500);
  }
});

// AI Router: Routed Natural Language Search
app.post("/make-server-49c0e13c/ai-router/natural-search", async (c) => {
  try {
    const { query } = await c.req.json();
    if (!query) return c.json({ error: "query required" }, 400);
    console.log("[AI-ROUTER] Routed natural search", query);
    const result = await aiRouter.routedNaturalSearch(query);
    return c.json(result);
  } catch (error: any) {
    console.error("[AI-ROUTER] Natural search error:", error.message);
    return c.json({ error: `AI router search error: ${error.message}` }, 500);
  }
});

// AI Router: Routed SPARQL Translation
app.post("/make-server-49c0e13c/ai-router/sparql-translate", async (c) => {
  try {
    const { query } = await c.req.json();
    if (!query) return c.json({ error: "query required" }, 400);
    console.log("[AI-ROUTER] Routed SPARQL translation", query);
    const result = await aiRouter.routedSPARQLTranslate(query);
    return c.json(result);
  } catch (error: any) {
    console.error("[AI-ROUTER] SPARQL error:", error.message);
    return c.json({ error: `AI router SPARQL error: ${error.message}` }, 500);
  }
});

// AI Router: Routed Auto-Fill
app.post("/make-server-49c0e13c/ai-router/autofill", async (c) => {
  try {
    const input = await c.req.json();
    console.log("[AI-ROUTER] Routed auto-fill", Object.keys(input));
    const result = await aiRouter.routedAutoFill(input);
    return c.json(result);
  } catch (error: any) {
    console.error("[AI-ROUTER] Auto-fill error:", error.message);
    return c.json({ error: `AI router auto-fill error: ${error.message}` }, 500);
  }
});

// AI Router: Routed Discovery Enhancement
app.post("/make-server-49c0e13c/ai-router/discovery-enhance", async (c) => {
  try {
    const { query } = await c.req.json();
    if (!query) return c.json({ error: "query required" }, 400);
    console.log("[AI-ROUTER] Discovery enhancement", query);
    const result = await aiRouter.routedDiscoveryEnhance(query);
    return c.json(result);
  } catch (error: any) {
    console.error("[AI-ROUTER] Discovery error:", error.message);
    return c.json({ error: `AI router discovery error: ${error.message}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════
// LD4 LINKED DATA INTEGRATION
// ═══════════════════════════════════════════════════════════

// LD4: Service Health Check
app.get("/make-server-49c0e13c/ld4/status", async (c) => {
  try {
    const services = await ld4.checkLD4Services();
    return c.json({ services, timestamp: new Date().toISOString() });
  } catch (error: any) {
    console.error("[LD4] Status check error:", error.message);
    return c.json({ error: `LD4 status error: ${error.message}` }, 500);
  }
});

// LD4: Fetch Profiles
app.get("/make-server-49c0e13c/ld4/profiles", async (c) => {
  try {
    const profiles = await ld4.fetchLD4Profiles();
    return c.json({ profiles, count: profiles.length });
  } catch (error: any) {
    console.error("[LD4] Profiles error:", error.message);
    return c.json({ error: `LD4 profiles error: ${error.message}` }, 500);
  }
});

// LD4: Import Profile
app.post("/make-server-49c0e13c/ld4/profiles/import", async (c) => {
  try {
    const { profileId } = await c.req.json();
    if (!profileId) return c.json({ error: "profileId required" }, 400);
    const profile = await ld4.importLD4Profile(profileId);
    if (!profile) return c.json({ error: "Profile not found" }, 404);
    return c.json({ success: true, profile });
  } catch (error: any) {
    return c.json({ error: `Profile import error: ${error.message}` }, 500);
  }
});

// LD4: Sinopia Templates
app.get("/make-server-49c0e13c/ld4/sinopia/templates", async (c) => {
  try {
    const templates = await ld4.getSinopiaTemplates();
    return c.json({ templates, count: templates.length });
  } catch (error: any) {
    return c.json({ error: `Sinopia templates error: ${error.message}` }, 500);
  }
});

// LD4: Import Sinopia Template
app.post("/make-server-49c0e13c/ld4/sinopia/import", async (c) => {
  try {
    const raw = await c.req.json();
    const template = ld4.parseSinopiaTemplate(raw);
    await ld4.saveSinopiaTemplate(template);
    const moonTemplate = ld4.convertToMoonTemplate(template);
    return c.json({ success: true, template, moonTemplate });
  } catch (error: any) {
    return c.json({ error: `Sinopia import error: ${error.message}` }, 500);
  }
});

// LD4: Authority Reconciliation (federated)
app.get("/make-server-49c0e13c/ld4/reconcile", async (c) => {
  try {
    const query = c.req.query("q") || "";
    const type = c.req.query("type") || undefined;
    const sources = c.req.query("sources")?.split(",") || undefined;
    if (!query) return c.json({ error: "q parameter required" }, 400);
    console.log(`[LD4] Reconcile: "${query}" type=${type} sources=${sources?.join(",")}`);
    const result = await ld4.reconcileAuthority(query, type, sources);
    return c.json(result);
  } catch (error: any) {
    console.error("[LD4] Reconcile error:", error.message);
    return c.json({ error: `Reconciliation error: ${error.message}` }, 500);
  }
});

// LD4: Authority Search (single source)
app.get("/make-server-49c0e13c/ld4/authority/search", async (c) => {
  try {
    const query = c.req.query("q") || "";
    const source = c.req.query("source") || "LOC";
    const type = c.req.query("type") || undefined;
    if (!query) return c.json({ error: "q parameter required" }, 400);
    const results = await ld4.searchAuthority(query, source, type);
    return c.json({ results, count: results.length, source });
  } catch (error: any) {
    return c.json({ error: `Authority search error: ${error.message}` }, 500);
  }
});

// LD4: Authority Lookup (URI dereference)
app.get("/make-server-49c0e13c/ld4/authority/lookup", async (c) => {
  try {
    const uri = c.req.query("uri") || "";
    if (!uri) return c.json({ error: "uri parameter required" }, 400);
    const result = await ld4.lookupAuthority(uri);
    return c.json({ result });
  } catch (error: any) {
    return c.json({ error: `Authority lookup error: ${error.message}` }, 500);
  }
});

// LD4: Federated Discovery
app.get("/make-server-49c0e13c/ld4/discover", async (c) => {
  try {
    const query = c.req.query("q") || "";
    const sources = c.req.query("sources")?.split(",") || undefined;
    if (!query) return c.json({ error: "q parameter required" }, 400);
    console.log(`[LD4] Federated discovery: "${query}"`);
    const result = await ld4.federatedDiscovery(query, sources);
    return c.json(result);
  } catch (error: any) {
    console.error("[LD4] Discovery error:", error.message);
    return c.json({ error: `Discovery error: ${error.message}` }, 500);
  }
});

// LD4: Linked Data Resource (with content negotiation)
app.get("/make-server-49c0e13c/ld4/resource/:type/:id", async (c) => {
  try {
    const type = c.req.param("type") || "";
    const id = c.req.param("id") || "";
    const accept = c.req.header("Accept") || "application/ld+json";
    const resource = await ld4.getLinkedDataResource(type, id);
    if (!resource) return c.json({ error: `Resource not found: ${type}/${id}` }, 404);
    const format = ld4.negotiateFormat(accept);
    const serialized = ld4.serializeResource(resource, format);
    return new Response(serialized.content, {
      headers: { "Content-Type": serialized.contentType, "Access-Control-Allow-Origin": "*" },
    });
  } catch (error: any) {
    return c.json({ error: `Resource error: ${error.message}` }, 500);
  }
});

// AI Router: Reset Circuit Breaker
app.post("/make-server-49c0e13c/ai-router/reset-circuit/:provider", (c) => {
  try {
    const provider = c.req.param("provider") as any;
    if (!["openai", "gemini", "llama"].includes(provider)) {
      return c.json({ error: "Invalid provider. Must be: openai, gemini, llama" }, 400);
    }
    aiRouter.resetCircuitBreaker(provider);
    return c.json({ success: true, provider, message: `Circuit breaker for ${provider} reset` });
  } catch (error: any) {
    console.error("[AI-ROUTER] Circuit reset error:", error.message);
    return c.json({ error: `Circuit reset error: ${error.message}` }, 500);
  }
});

// ===== FIELD TEMPLATE PERSISTENCE =====

// GET all saved field templates
app.get("/make-server-49c0e13c/field-templates", async (c) => {
  try {
    const data = await kv.get("field-templates-all");
    const templates = data ? (typeof data === "string" ? JSON.parse(data) : data) : [];
    return c.json({ success: true, templates });
  } catch (error) {
    console.log("Error loading field templates:", error);
    return c.json({ success: false, error: String(error), templates: [] }, 500);
  }
});

// PUT save/overwrite all field templates
app.put("/make-server-49c0e13c/field-templates", async (c) => {
  try {
    if (!(await getSession(c))) {
      return c.json({ success: false, error: "Sign in to change field templates" }, 401);
    }
    const { templates } = await c.req.json();
    if (!Array.isArray(templates)) {
      return c.json({ success: false, error: "templates must be an array" }, 400);
    }
    await kv.set("field-templates-all", JSON.stringify(templates));
    return c.json({ success: true, count: templates.length });
  } catch (error) {
    console.log("Error saving field templates:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// DELETE a single field template by id
app.delete("/make-server-49c0e13c/field-templates/:id", async (c) => {
  try {
    if (!(await getSession(c))) {
      return c.json({ success: false, error: "Sign in to change field templates" }, 401);
    }
    const id = c.req.param("id");
    const data = await kv.get("field-templates-all");
    const templates = data ? (typeof data === "string" ? JSON.parse(data) : data) : [];
    const updated = templates.filter((t: any) => t.id !== id);
    await kv.set("field-templates-all", JSON.stringify(updated));
    return c.json({ success: true, remaining: updated.length });
  } catch (error) {
    console.log("Error deleting field template:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

Deno.serve(app.fetch);
