/*
 * Search lab: builds, runs and compares `multi_search` requests so search settings can be
 * tuned before they go into a client. Everything here is plain data in, plain data out;
 * the page and composable add the UI and the network.
 */

export type ParamKind = 'number' | 'boolean' | 'text';

export interface ParamDef {
  key: string;
  label: string;
  kind: ParamKind;
  /** One line on what raising or lowering it does. */
  hint: string;
  /** What Typesense does when the parameter is left out. */
  fallback: string;
  min?: number;
  max?: number;
  options?: string[];
}

/** The tuning knobs offered for the whole request and, as overrides, for each collection. */
export const PARAM_DEFS: ParamDef[] = [
  {
    key: 'num_typos',
    label: 'Typos allowed',
    kind: 'number',
    min: 0,
    max: 2,
    fallback: '2',
    hint: 'Most spelling mistakes tolerated per word. 0 makes matching exact.',
  },
  {
    key: 'min_len_1typo',
    label: 'Min length, 1 typo',
    kind: 'number',
    min: 1,
    max: 20,
    fallback: '4',
    hint: 'Words shorter than this must match exactly.',
  },
  {
    key: 'min_len_2typo',
    label: 'Min length, 2 typos',
    kind: 'number',
    min: 1,
    max: 20,
    fallback: '7',
    hint: 'Words shorter than this tolerate at most one typo.',
  },
  {
    key: 'prefix',
    label: 'Match prefixes',
    kind: 'boolean',
    fallback: 'on',
    hint: 'Treat the last word as unfinished, so "sho" finds "shoes". Turn on for search-as-you-type.',
  },
  {
    key: 'drop_tokens_threshold',
    label: 'Drop words below',
    kind: 'number',
    min: 0,
    max: 1000,
    fallback: '1',
    hint: 'If fewer results than this, retry without the last words. 0 never drops words.',
  },
  {
    key: 'typo_tokens_threshold',
    label: 'Try typos below',
    kind: 'number',
    min: 0,
    max: 1000,
    fallback: '1',
    hint: 'If fewer results than this, retry allowing typos. Raise it to show fuzzy matches sooner.',
  },
  {
    key: 'max_candidates',
    label: 'Max candidates',
    kind: 'number',
    min: 0,
    max: 10000,
    fallback: '4',
    hint: 'Similar words considered for prefix and typo matches. Higher finds more but is slower.',
  },
  {
    key: 'text_match_type',
    label: 'Multi-field scoring',
    kind: 'text',
    options: ['max_score', 'max_weight', 'sum_score'],
    fallback: 'max_score',
    hint: 'How scores from several fields combine: the best field, the heaviest field, or all of them.',
  },
  {
    key: 'prioritize_exact_match',
    label: 'Exact matches first',
    kind: 'boolean',
    fallback: 'on',
    hint: 'Rank a document that matches the query exactly above partial matches.',
  },
  {
    key: 'prioritize_token_position',
    label: 'Earlier words first',
    kind: 'boolean',
    fallback: 'off',
    hint: 'Rank matches near the start of a field above matches later in it.',
  },
  {
    key: 'prioritize_num_matching_fields',
    label: 'More fields first',
    kind: 'boolean',
    fallback: 'on',
    hint: 'Rank documents that match in more fields above those that match in one.',
  },
  {
    key: 'exhaustive_search',
    label: 'Exhaustive search',
    kind: 'boolean',
    fallback: 'off',
    hint: 'Consider every possible word combination. Slower; only for debugging relevance.',
  },
  {
    key: 'enable_overrides',
    label: 'Apply curations',
    kind: 'boolean',
    fallback: 'on',
    hint: 'Switch off to see results without pins, hides and rewrites.',
  },
  {
    key: 'per_page',
    label: 'Results per page',
    kind: 'number',
    min: 1,
    max: 250,
    fallback: '10',
    hint: 'How many documents come back for each collection.',
  },
  {
    key: 'stopwords',
    label: 'Stopword set',
    kind: 'text',
    fallback: 'none',
    hint: 'Name of a stopword set whose words are dropped from the query.',
  },
  {
    key: 'preset',
    label: 'Search preset',
    kind: 'text',
    fallback: 'none',
    hint: 'Name of a stored preset. Anything set here overrides what the preset says.',
  },
  {
    key: 'override_tags',
    label: 'Curation tags',
    kind: 'text',
    fallback: 'none',
    hint: 'Only curations with these tags apply (comma-separated).',
  },
  {
    key: 'include_fields',
    label: 'Return fields',
    kind: 'text',
    fallback: 'all',
    hint: 'Comma-separated fields to return. Use $other_collection(*) to include joined documents.',
  },
  {
    key: 'exclude_fields',
    label: 'Leave out fields',
    kind: 'text',
    fallback: 'none',
    hint: 'Comma-separated fields to drop from the response, such as embeddings.',
  },
];

/** The three query parameters a client nearly always sets, shown above the tuning knobs. */
export const CORE_PARAMS = [
  { key: 'filter_by', label: 'Filter', placeholder: 'in_stock:true && price:<50' },
  { key: 'sort_by', label: 'Sort', placeholder: '_text_match:desc, popularity:desc' },
  { key: 'facet_by', label: 'Facets', placeholder: 'brand, category' },
] as const;

const KNOWN_PARAM_KEYS = new Set<string>([
  ...PARAM_DEFS.map((p) => p.key),
  ...CORE_PARAMS.map((p) => p.key),
]);

export interface LabSearch {
  id: string;
  collection: string;
  /** Fields searched, in priority order. */
  queryBy: string[];
  /** Weight per field. Empty means Typesense's own order-based weighting. */
  weights: Record<string, number>;
  /** Filter, sort, facets and tuning knobs set on this collection. */
  params: Record<string, unknown>;
  /** Any other parameters, as JSON text, merged in last. */
  extra: string;
}

export interface LabConfig {
  q: string;
  /** Applies to every collection unless the collection sets its own. */
  common: Record<string, unknown>;
  searches: LabSearch[];
}

export interface LabRequest {
  /** Sent in the query string, shared by every search. */
  commonParams: Record<string, unknown>;
  searches: Record<string, unknown>[];
}

let counter = 0;
export function newId(prefix = 's'): string {
  counter += 1;
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}`;
}

interface FieldLike {
  name: string;
  type: string;
  index?: boolean;
}

/** Text fields a search can use: indexed strings, without wildcard patterns. */
export function searchableFields(fields: FieldLike[] | undefined): string[] {
  return (fields ?? [])
    .filter(
      (f) => f.index !== false && ['string', 'string[]'].includes(f.type) && !f.name.includes('*'),
    )
    .map((f) => f.name);
}

export function createSearch(collection: string, fields?: FieldLike[]): LabSearch {
  return {
    id: newId(),
    collection,
    queryBy: searchableFields(fields).slice(0, 4),
    weights: {},
    params: {},
    extra: '',
  };
}

/**
 * The same search pointed at another collection. Tuning knobs carry over; fields, filter,
 * sort and facets belong to the old schema, so they start fresh.
 */
export function switchCollection(
  search: LabSearch,
  collection: string,
  fields?: FieldLike[],
): LabSearch {
  const params = { ...search.params };
  for (const p of CORE_PARAMS) delete params[p.key];
  return { ...createSearch(collection, fields), id: search.id, params, extra: search.extra };
}

export function duplicateSearch(search: LabSearch): LabSearch {
  return JSON.parse(JSON.stringify({ ...search, id: newId() })) as LabSearch;
}

export function defaultConfig(): LabConfig {
  return { q: '', common: {}, searches: [] };
}

/** Weights that reproduce Typesense's default: the first field counts most. */
export function seedWeights(queryBy: string[]): Record<string, number> {
  return Object.fromEntries(queryBy.map((field, i) => [field, queryBy.length - i]));
}

function omit(obj: Record<string, unknown>, key: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => k !== key));
}

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (typeof value === 'number') return Number.isNaN(value);
  return false;
}

/** Drops unset values so the request only carries what was chosen. */
export function cleanParams(params: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (isEmpty(value)) continue;
    out[key] = typeof value === 'string' ? value.trim() : value;
  }
  return out;
}

export function parseExtra(text: string): { value: Record<string, unknown>; error?: string } {
  if (!text.trim()) return { value: {} };
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { value: {}, error: 'Extra parameters must be a JSON object.' };
    }
    return { value: parsed as Record<string, unknown> };
  } catch (e) {
    return { value: {}, error: (e as Error).message };
  }
}

/** One search as sent to Typesense. */
export function buildSearch(search: LabSearch): Record<string, unknown> {
  const weighted = search.queryBy.some((f) => search.weights[f] !== undefined);
  return {
    collection: search.collection,
    ...(search.queryBy.length ? { query_by: search.queryBy.join(',') } : {}),
    ...(weighted && search.queryBy.length
      ? { query_by_weights: search.queryBy.map((f) => search.weights[f] ?? 1).join(',') }
      : {}),
    ...cleanParams(search.params),
    ...parseExtra(search.extra).value,
  };
}

export function buildRequest(config: LabConfig): LabRequest {
  return {
    commonParams: { q: config.q.trim() || '*', ...cleanParams(config.common) },
    searches: config.searches.map(buildSearch),
  };
}

/** Problems that would make Typesense reject the request, found before sending it. */
export function validateConfig(config: LabConfig): string[] {
  const problems: string[] = [];
  if (!config.searches.length) problems.push('Add a collection to search.');
  config.searches.forEach((s) => {
    const label = s.collection || 'A search';
    if (!s.collection) problems.push('Pick a collection for every search.');
    const hasPreset = !!cleanParams({ ...config.common, ...s.params }).preset;
    if (!s.queryBy.length && !hasPreset && !parseExtra(s.extra).value.query_by) {
      problems.push(`${label}: choose at least one field to search, or a preset.`);
    }
    const extra = parseExtra(s.extra);
    if (extra.error)
      problems.push(`${label}: extra parameters are not valid JSON (${extra.error}).`);
  });
  return problems;
}

/** Request for one saved test: its query, only the collection it names, and room for its top N. */
export function requestForTest(config: LabConfig, test: LabTest): LabRequest | null {
  const searches = config.searches.filter(
    (s) => !test.collection || s.collection === test.collection,
  );
  if (!searches.length) return null;
  const base = buildRequest({ ...config, q: test.q, searches });
  const commonPerPage = Number(base.commonParams.per_page ?? 10);
  return {
    commonParams: base.commonParams,
    searches: base.searches.map((s) => ({
      ...s,
      per_page: Math.max(Number(s.per_page ?? commonPerPage), test.top),
    })),
  };
}

// ---- Results ---------------------------------------------------------------------------

export interface LabHit {
  id: string;
  collection: string;
  /** 1-based rank within its collection. */
  position: number;
  textMatch?: number;
  textMatchInfo?: Record<string, unknown>;
  vectorDistance?: number;
  document: Record<string, unknown>;
  /** Highlight snippets by field name. */
  snippets: Record<string, string>;
}

export interface LabFacet {
  field: string;
  counts: { value: string; count: number }[];
}

export interface LabResult {
  collection: string;
  found: number;
  outOf: number;
  searchTimeMs: number;
  hits: LabHit[];
  facets: LabFacet[];
  error?: string;
}

type Raw = Record<string, any>;

function snippetsOf(hit: Raw): Record<string, string> {
  const out: Record<string, string> = {};
  const highlight = hit.highlight as Raw | undefined;
  if (highlight && typeof highlight === 'object') {
    for (const [field, value] of Object.entries(highlight)) {
      if (typeof value?.snippet === 'string') out[field] = value.snippet;
      else if (Array.isArray(value)) {
        const first = value.find((v: Raw) => typeof v?.snippet === 'string');
        if (first) out[field] = first.snippet as string;
      }
    }
  }
  for (const h of (hit.highlights as Raw[] | undefined) ?? []) {
    const field = h?.field as string | undefined;
    if (field && !(field in out) && typeof h.snippet === 'string') out[field] = h.snippet;
  }
  return out;
}

/** Reads a `multi_search` response. Results line up with the searches that were sent. */
export function parseResponse(response: unknown, sent: { collection?: unknown }[]): LabResult[] {
  const raw = ((response as Raw | undefined)?.results ?? []) as Raw[];
  return sent.map((s, index) => {
    const collection = typeof s.collection === 'string' ? s.collection : '';
    const r = raw[index];
    if (!r)
      return {
        collection,
        found: 0,
        outOf: 0,
        searchTimeMs: 0,
        hits: [],
        facets: [],
        error: 'No result returned.',
      };
    if (typeof r.error === 'string') {
      return {
        collection,
        found: 0,
        outOf: 0,
        searchTimeMs: 0,
        hits: [],
        facets: [],
        error: r.error,
      };
    }
    const hits: LabHit[] = ((r.hits ?? []) as Raw[]).map((h, i) => {
      const document = (h.document ?? {}) as Record<string, unknown>;
      return {
        id:
          typeof document.id === 'string' || typeof document.id === 'number'
            ? String(document.id)
            : '',
        collection,
        position: i + 1,
        ...(typeof h.text_match === 'number' ? { textMatch: h.text_match } : {}),
        ...(h.text_match_info
          ? { textMatchInfo: h.text_match_info as Record<string, unknown> }
          : {}),
        ...(typeof h.vector_distance === 'number' ? { vectorDistance: h.vector_distance } : {}),
        document,
        snippets: snippetsOf(h),
      };
    });
    const facets: LabFacet[] = ((r.facet_counts ?? []) as Raw[]).map((f) => ({
      field: String(f.field_name ?? ''),
      counts: ((f.counts ?? []) as Raw[]).map((c) => ({
        value: String(c.value ?? ''),
        count: Number(c.count ?? 0),
      })),
    }));
    return {
      collection: (r.request_params?.collection_name as string | undefined) ?? collection,
      found: Number(r.found ?? 0),
      outOf: Number(r.out_of ?? 0),
      searchTimeMs: Number(r.search_time_ms ?? 0),
      hits,
      facets,
    };
  });
}

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

/**
 * Typesense snippets contain raw document text with `<mark>` around matches. Escape
 * everything except those tags so a document can't inject markup into the page.
 */
export function safeHighlight(snippet: string): string {
  return snippet
    .replace(/[&<>"]/g, (c) => ESCAPES[c] ?? c)
    .replace(/&lt;mark&gt;/g, '<mark>')
    .replace(/&lt;\/mark&gt;/g, '</mark>');
}

// ---- Comparing runs --------------------------------------------------------------------

export type RankStatus = 'same' | 'up' | 'down' | 'new' | 'gone';

export interface RankChange {
  id: string;
  status: RankStatus;
  /** Position now, or null if the document dropped out. */
  now: number | null;
  before: number | null;
  /** Places moved; positive means it rose. */
  delta: number;
}

/** How each document moved between a baseline run and the current one, for one collection. */
export function diffHits(current: LabHit[], baseline: LabHit[]): RankChange[] {
  const before = new Map(baseline.map((h) => [h.id, h.position]));
  const now = new Map(current.map((h) => [h.id, h.position]));
  const changes: RankChange[] = current.map((h) => {
    const was = before.get(h.id);
    if (was === undefined)
      return { id: h.id, status: 'new', now: h.position, before: null, delta: 0 };
    const delta = was - h.position;
    return {
      id: h.id,
      status: delta === 0 ? 'same' : delta > 0 ? 'up' : 'down',
      now: h.position,
      before: was,
      delta,
    };
  });
  for (const h of baseline) {
    if (!now.has(h.id)) {
      changes.push({ id: h.id, status: 'gone', now: null, before: h.position, delta: 0 });
    }
  }
  return changes;
}

export function summarizeDiff(changes: RankChange[]) {
  const count = (status: RankStatus) => changes.filter((c) => c.status === status).length;
  return {
    same: count('same'),
    up: count('up'),
    down: count('down'),
    added: count('new'),
    removed: count('gone'),
    identical: changes.every((c) => c.status === 'same'),
  };
}

// ---- Test set --------------------------------------------------------------------------

export interface LabTest {
  id: string;
  q: string;
  /** Empty means any collection in the lab. */
  collection: string;
  /** Document IDs that should appear. */
  expect: string[];
  /** ...within this many places. */
  top: number;
}

export interface TestOutcome {
  pass: boolean;
  /** Each expected ID and its best position, or null when it was not returned. */
  found: { id: string; position: number | null }[];
  error?: string;
}

export function createTest(partial: Partial<LabTest> = {}): LabTest {
  return { id: newId('t'), q: '', collection: '', expect: [], top: 3, ...partial };
}

/** Splits "a, b\nc" into IDs. */
export function parseIds(text: string): string[] {
  return text
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function evaluateTest(test: LabTest, results: LabResult[]): TestOutcome {
  const failed = results.find((r) => r.error);
  if (failed) return { pass: false, found: [], error: failed.error as string };
  const found = test.expect.map((id) => {
    const positions = results
      .filter((r) => !test.collection || r.collection === test.collection)
      .flatMap((r) => r.hits.filter((h) => h.id === id).map((h) => h.position));
    return { id, position: positions.length ? Math.min(...positions) : null };
  });
  const pass =
    found.length > 0 && found.every((f) => f.position !== null && f.position <= test.top);
  return { pass, found };
}

// ---- Presets and pasted requests ---------------------------------------------------------

/** What to store as a search preset: one search's parameters, or a `searches` list for several. */
export function toPresetValue(config: LabConfig): Record<string, unknown> {
  const request = buildRequest(config);
  const shared = omit(request.commonParams, 'q');
  const searches = request.searches.map((s) => ({ ...shared, ...s }));
  if (searches.length === 1) return omit(searches[0] as Record<string, unknown>, 'collection');
  return { searches };
}

function searchFromRaw(raw: Record<string, unknown>, fallbackCollection: string): LabSearch {
  const { collection, query_by, query_by_weights, ...rest } = raw;
  const queryBy =
    typeof query_by === 'string'
      ? query_by
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
  const weightList =
    typeof query_by_weights === 'string'
      ? query_by_weights.split(',').map((s) => Number(s.trim()))
      : [];
  const weights: Record<string, number> = {};
  queryBy.forEach((field, i) => {
    const w = weightList[i];
    if (w !== undefined && !Number.isNaN(w)) weights[field] = w;
  });
  const params: Record<string, unknown> = {};
  const extra: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rest)) {
    if (key === 'q') continue;
    (KNOWN_PARAM_KEYS.has(key) ? params : extra)[key] = value;
  }
  return {
    id: newId(),
    collection: typeof collection === 'string' ? collection : fallbackCollection,
    queryBy,
    weights,
    params,
    extra: Object.keys(extra).length ? JSON.stringify(extra, null, 2) : '',
  };
}

/**
 * Searches from a pasted request body (`{ searches: [...] }`), a single search's parameters,
 * or a stored preset's value. Throws a readable error for anything else.
 */
export function searchesFromJson(json: string, fallbackCollection = ''): LabSearch[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    throw new Error(`That is not valid JSON: ${(e as Error).message}`, { cause: e });
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Expected a JSON object.');
  }
  const obj = parsed as Record<string, unknown>;
  if (Array.isArray(obj.searches)) {
    return obj.searches
      .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
      .map((s) => searchFromRaw(s, fallbackCollection));
  }
  return [searchFromRaw(obj, fallbackCollection)];
}

// ---- Code for a client -----------------------------------------------------------------

export interface NodeInfo {
  protocol: string;
  host: string;
  port: number | string;
  path?: string;
}

function baseUrl(node: NodeInfo): string {
  return `${node.protocol}://${node.host}:${node.port}${node.path ?? ''}`;
}

function queryString(params: Record<string, unknown>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
}

/** The HTTP request: path with the shared parameters, and the JSON body. */
export function describeRequest(request: LabRequest) {
  return {
    method: 'POST',
    path: `/multi_search?${queryString(request.commonParams)}`,
    body: { searches: request.searches },
  };
}

export function toCurl(request: LabRequest, node: NodeInfo): string {
  const { path, body } = describeRequest(request);
  return [
    `curl -X POST '${baseUrl(node)}${path}' \\`,
    `  -H 'X-TYPESENSE-API-KEY: SEARCH_ONLY_API_KEY' \\`,
    `  -H 'Content-Type: application/json' \\`,
    `  -d '${JSON.stringify(body, null, 2).replace(/'/g, `'\\''`)}'`,
  ].join('\n');
}

export function toTypesenseJs(request: LabRequest, node: NodeInfo): string {
  return [
    `import Typesense from 'typesense';`,
    ``,
    `const client = new Typesense.Client({`,
    `  nodes: [{ host: '${node.host}', port: ${node.port}, protocol: '${node.protocol}' }],`,
    `  apiKey: 'SEARCH_ONLY_API_KEY',`,
    `});`,
    ``,
    `const results = await client.multiSearch.perform(`,
    `  ${JSON.stringify({ searches: request.searches }, null, 2).replace(/\n/g, '\n  ')},`,
    `  ${JSON.stringify(request.commonParams)},`,
    `);`,
  ].join('\n');
}

/**
 * Settings for typesense-instantsearch-adapter. The query text comes from the search box,
 * so `q` is left out; each collection's own settings go in collectionSpecificSearchParameters.
 */
export function toInstantSearchAdapter(request: LabRequest, node: NodeInfo): string {
  const shared = omit(request.commonParams, 'q');
  const perCollection: Record<string, Record<string, unknown>> = {};
  for (const s of request.searches) {
    const { collection, ...rest } = s;
    if (typeof collection === 'string') perCollection[collection] = rest;
  }
  return [
    `import TypesenseInstantSearchAdapter from 'typesense-instantsearch-adapter';`,
    ``,
    `const adapter = new TypesenseInstantSearchAdapter({`,
    `  server: {`,
    `    apiKey: 'SEARCH_ONLY_API_KEY',`,
    `    nodes: [{ host: '${node.host}', port: ${node.port}, protocol: '${node.protocol}' }],`,
    `  },`,
    `  additionalSearchParameters: ${JSON.stringify(shared, null, 2).replace(/\n/g, '\n  ')},`,
    `  collectionSpecificSearchParameters: ${JSON.stringify(perCollection, null, 2).replace(/\n/g, '\n  ')},`,
    `});`,
    `const searchClient = adapter.searchClient;`,
  ].join('\n');
}
