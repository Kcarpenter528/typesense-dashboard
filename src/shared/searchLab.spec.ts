import { describe, expect, it } from 'vitest';
import {
  buildRequest,
  buildSearch,
  cleanParams,
  createSearch,
  createTest,
  defaultConfig,
  describeRequest,
  diffHits,
  duplicateSearch,
  evaluateTest,
  parseIds,
  parseResponse,
  requestForTest,
  safeHighlight,
  searchesFromJson,
  searchableFields,
  seedWeights,
  summarizeDiff,
  switchCollection,
  toCurl,
  toInstantSearchAdapter,
  toPresetValue,
  toTypesenseJs,
  validateConfig,
} from './searchLab';
import type { LabConfig, LabHit, LabResult, LabSearch } from './searchLab';

const node = { protocol: 'http', host: 'localhost', port: 8108 };

function search(overrides: Partial<LabSearch> = {}): LabSearch {
  return {
    id: 's1',
    collection: 'products',
    queryBy: ['title', 'brand'],
    weights: {},
    params: {},
    extra: '',
    ...overrides,
  };
}

function config(overrides: Partial<LabConfig> = {}): LabConfig {
  return { q: 'shoes', common: {}, searches: [search()], ...overrides };
}

function hit(id: string, position: number, collection = 'products'): LabHit {
  return { id, collection, position, document: { id }, snippets: {} };
}

function result(ids: string[], collection = 'products'): LabResult {
  return {
    collection,
    found: ids.length,
    outOf: 100,
    searchTimeMs: 1,
    hits: ids.map((id, i) => hit(id, i + 1, collection)),
    facets: [],
  };
}

describe('cleanParams', () => {
  it('drops unset values but keeps zero and false', () => {
    expect(
      cleanParams({ a: '', b: '  ', c: undefined, d: null, e: NaN, f: 0, g: false, h: ' x ' }),
    ).toEqual({ f: 0, g: false, h: 'x' });
  });
});

describe('buildSearch', () => {
  it('joins query_by and leaves weights to Typesense until one is set', () => {
    expect(buildSearch(search())).toEqual({ collection: 'products', query_by: 'title,brand' });
  });

  it('aligns weights with field order and defaults unset fields to 1', () => {
    const s = search({ queryBy: ['title', 'brand', 'tags'], weights: { brand: 5, title: 9 } });
    expect(buildSearch(s)).toMatchObject({
      query_by: 'title,brand,tags',
      query_by_weights: '9,5,1',
    });
  });

  it('puts params first and lets extra JSON override them', () => {
    const s = search({
      params: { num_typos: 0, filter_by: 'in_stock:true' },
      extra: '{"num_typos":1}',
    });
    expect(buildSearch(s)).toMatchObject({ num_typos: 1, filter_by: 'in_stock:true' });
  });

  it('ignores invalid extra JSON instead of throwing', () => {
    expect(buildSearch(search({ extra: '{nope' }))).toEqual({
      collection: 'products',
      query_by: 'title,brand',
    });
  });
});

describe('switchCollection', () => {
  it('keeps tuning and identity but resets schema-specific settings', () => {
    const original = search({
      id: 'keep',
      queryBy: ['title'],
      weights: { title: 3 },
      params: { num_typos: 0, filter_by: 'price:<5', sort_by: 'price:asc', facet_by: 'brand' },
      extra: '{"x":1}',
    });
    const next = switchCollection(original, 'articles', [{ name: 'body', type: 'string' }]);
    expect(next).toMatchObject({
      id: 'keep',
      collection: 'articles',
      queryBy: ['body'],
      weights: {},
      params: { num_typos: 0 },
      extra: '{"x":1}',
    });
  });
});

describe('buildRequest', () => {
  it('searches * when the query is empty and shares common params', () => {
    const request = buildRequest(config({ q: '  ', common: { per_page: 5, prefix: false } }));
    expect(request.commonParams).toEqual({ q: '*', per_page: 5, prefix: false });
    expect(request.searches).toHaveLength(1);
  });

  it('keeps one entry per collection, including duplicates of the same collection', () => {
    const a = search({ id: 'a', params: { num_typos: 0 } });
    const b = duplicateSearch(a);
    const request = buildRequest(config({ searches: [a, b] }));
    expect(request.searches.map((s) => s.collection)).toEqual(['products', 'products']);
    expect(b.id).not.toBe(a.id);
  });
});

describe('validateConfig', () => {
  it('asks for a collection and fields', () => {
    expect(validateConfig(config({ searches: [] }))).toEqual(['Add a collection to search.']);
    expect(validateConfig(config({ searches: [search({ queryBy: [] })] }))[0]).toMatch(
      /choose at least one field/,
    );
  });

  it('accepts a preset in place of query_by', () => {
    const s = search({ queryBy: [], params: { preset: 'listing' } });
    expect(validateConfig(config({ searches: [s] }))).toEqual([]);
    expect(
      validateConfig(config({ searches: [search({ queryBy: [] })], common: { preset: 'p' } })),
    ).toEqual([]);
  });

  it('reports invalid extra JSON', () => {
    expect(validateConfig(config({ searches: [search({ extra: '[1]' })] }))[0]).toMatch(
      /JSON object/,
    );
  });
});

describe('fields and weights', () => {
  it('offers indexed text fields only', () => {
    expect(
      searchableFields([
        { name: 'title', type: 'string' },
        { name: 'tags', type: 'string[]' },
        { name: 'price', type: 'float' },
        { name: 'hidden', type: 'string', index: false },
        { name: 'attr_.*', type: 'string' },
      ]),
    ).toEqual(['title', 'tags']);
  });

  it('starts new searches on up to four text fields', () => {
    const s = createSearch(
      'c',
      ['a', 'b', 'c', 'd', 'e'].map((name) => ({ name, type: 'string' })),
    );
    expect(s.queryBy).toEqual(['a', 'b', 'c', 'd']);
  });

  it('seeds weights so the first field counts most', () => {
    expect(seedWeights(['a', 'b', 'c'])).toEqual({ a: 3, b: 2, c: 1 });
  });
});

describe('parseResponse', () => {
  const response = {
    results: [
      {
        found: 2,
        out_of: 50,
        search_time_ms: 3,
        request_params: { collection_name: 'products' },
        hits: [
          {
            document: { id: '7', title: 'Red shoe' },
            text_match: 100,
            text_match_info: { tokens_matched: 1 },
            highlight: { title: { snippet: 'Red <mark>shoe</mark>' } },
          },
          { document: { id: '9' }, highlights: [{ field: 'brand', snippet: '<mark>Nike</mark>' }] },
        ],
        facet_counts: [{ field_name: 'brand', counts: [{ value: 'Nike', count: 4 }] }],
      },
      { code: 400, error: 'Could not find a field named `x`' },
    ],
  };

  it('reads hits, ranks, snippets and facets', () => {
    const [products] = parseResponse(response, [
      { collection: 'products' },
      { collection: 'brands' },
    ]);
    expect(products?.found).toBe(2);
    expect(products?.hits.map((h) => [h.id, h.position])).toEqual([
      ['7', 1],
      ['9', 2],
    ]);
    expect(products?.hits[0]?.snippets.title).toBe('Red <mark>shoe</mark>');
    expect(products?.hits[1]?.snippets.brand).toBe('<mark>Nike</mark>');
    expect(products?.facets).toEqual([{ field: 'brand', counts: [{ value: 'Nike', count: 4 }] }]);
  });

  it('keeps a failed search as an error against its own collection', () => {
    const results = parseResponse(response, [{ collection: 'products' }, { collection: 'brands' }]);
    expect(results[1]).toMatchObject({
      collection: 'brands',
      error: 'Could not find a field named `x`',
    });
  });

  it('flags a search that got no result', () => {
    expect(parseResponse({ results: [] }, [{ collection: 'a' }])[0]?.error).toBe(
      'No result returned.',
    );
  });
});

describe('safeHighlight', () => {
  it('keeps mark tags and escapes everything else', () => {
    expect(safeHighlight('<img src=x onerror=1> a <mark>b</mark> & "c"')).toBe(
      '&lt;img src=x onerror=1&gt; a <mark>b</mark> &amp; &quot;c&quot;',
    );
  });
});

describe('diffHits', () => {
  it('reports moved, new and dropped documents', () => {
    const baseline = [hit('a', 1), hit('b', 2), hit('c', 3)];
    const current = [hit('b', 1), hit('d', 2), hit('a', 3)];
    const changes = diffHits(current, baseline);
    expect(changes.map((c) => [c.id, c.status, c.delta])).toEqual([
      ['b', 'up', 1],
      ['d', 'new', 0],
      ['a', 'down', -2],
      ['c', 'gone', 0],
    ]);
    expect(summarizeDiff(changes)).toMatchObject({
      up: 1,
      down: 1,
      added: 1,
      removed: 1,
      identical: false,
    });
  });

  it('is identical when nothing moved', () => {
    expect(summarizeDiff(diffHits([hit('a', 1)], [hit('a', 1)])).identical).toBe(true);
  });
});

describe('tests', () => {
  it('parses IDs separated by commas, spaces or lines', () => {
    expect(parseIds('1, 2\n3  4,')).toEqual(['1', '2', '3', '4']);
  });

  it('passes only when every expected ID is within the top N', () => {
    const test = createTest({ q: 'x', expect: ['a', 'c'], top: 3 });
    expect(evaluateTest(test, [result(['a', 'b', 'c'])])).toMatchObject({ pass: true });
    const outcome = evaluateTest({ ...test, top: 2 }, [result(['a', 'b', 'c'])]);
    expect(outcome.pass).toBe(false);
    expect(outcome.found).toEqual([
      { id: 'a', position: 1 },
      { id: 'c', position: 3 },
    ]);
  });

  it('reports a missing document as not found, and an empty expectation as failing', () => {
    expect(
      evaluateTest(createTest({ expect: ['zzz'] }), [result(['a'])]).found[0]?.position,
    ).toBeNull();
    expect(evaluateTest(createTest({ expect: [] }), [result(['a'])]).pass).toBe(false);
  });

  it('only looks in the named collection', () => {
    const results = [result(['a'], 'products'), result(['b'], 'articles')];
    expect(evaluateTest(createTest({ expect: ['b'], collection: 'products' }), results).pass).toBe(
      false,
    );
    expect(evaluateTest(createTest({ expect: ['b'], collection: 'articles' }), results).pass).toBe(
      true,
    );
    expect(evaluateTest(createTest({ expect: ['b'] }), results).pass).toBe(true);
  });

  it('fails with the search error', () => {
    const failed: LabResult = { ...result([]), error: 'boom' };
    expect(evaluateTest(createTest({ expect: ['a'] }), [failed])).toMatchObject({
      pass: false,
      error: 'boom',
    });
  });

  it('asks for enough results to see the top N and narrows to its collection', () => {
    const cfg = config({
      common: { per_page: 5 },
      searches: [
        search({ id: 'a' }),
        search({ id: 'b', collection: 'articles', params: { per_page: 20 } }),
      ],
    });
    const request = requestForTest(cfg, createTest({ q: 'boots', top: 10 }));
    expect(request?.commonParams.q).toBe('boots');
    expect(request?.searches.map((s) => s.per_page)).toEqual([10, 20]);
    const narrowed = requestForTest(cfg, createTest({ q: 'boots', collection: 'articles' }));
    expect(narrowed?.searches).toHaveLength(1);
    expect(requestForTest(cfg, createTest({ collection: 'nope' }))).toBeNull();
  });
});

describe('presets and pasted requests', () => {
  it('stores a single search without its collection or query', () => {
    const cfg = config({
      common: { num_typos: 1 },
      searches: [search({ params: { sort_by: 'price:asc' } })],
    });
    expect(toPresetValue(cfg)).toEqual({
      query_by: 'title,brand',
      num_typos: 1,
      sort_by: 'price:asc',
    });
  });

  it('stores several searches as a searches list with the shared settings folded in', () => {
    const cfg = config({
      common: { per_page: 5 },
      searches: [search(), search({ id: 'b', collection: 'articles', queryBy: ['body'] })],
    });
    expect(toPresetValue(cfg)).toEqual({
      searches: [
        { per_page: 5, collection: 'products', query_by: 'title,brand' },
        { per_page: 5, collection: 'articles', query_by: 'body' },
      ],
    });
  });

  it('reads a pasted request body back into searches, keeping unknown parameters as extra', () => {
    const [first, second] = searchesFromJson(
      JSON.stringify({
        searches: [
          {
            collection: 'products',
            q: 'x',
            query_by: 'title,brand',
            query_by_weights: '4,2',
            num_typos: 0,
            vector_query: 'v:([])',
          },
          { collection: 'articles', query_by: 'body' },
        ],
      }),
    );
    expect(first).toMatchObject({
      collection: 'products',
      queryBy: ['title', 'brand'],
      weights: { title: 4, brand: 2 },
      params: { num_typos: 0 },
    });
    expect(JSON.parse(first?.extra ?? '{}')).toEqual({ vector_query: 'v:([])' });
    expect(second?.weights).toEqual({});
  });

  it('reads a single search or preset and rejects other input', () => {
    expect(searchesFromJson('{"query_by":"a"}', 'c')[0]).toMatchObject({
      collection: 'c',
      queryBy: ['a'],
    });
    expect(() => searchesFromJson('nope')).toThrow(/not valid JSON/);
    expect(() => searchesFromJson('[1]')).toThrow(/JSON object/);
  });

  it('round-trips through buildSearch', () => {
    const original = search({
      weights: { title: 3, brand: 1 },
      params: { filter_by: 'a:1', prefix: false },
    });
    const [copy] = searchesFromJson(JSON.stringify({ searches: [buildSearch(original)] }));
    expect(buildSearch(copy as LabSearch)).toEqual(buildSearch(original));
  });
});

describe('client code', () => {
  const request = buildRequest(config({ common: { per_page: 5 } }));

  it('describes the HTTP request with shared params in the URL', () => {
    expect(describeRequest(request).path).toBe('/multi_search?q=shoes&per_page=5');
  });

  it('writes curl, typesense-js and adapter snippets from the same request', () => {
    expect(toCurl(request, node)).toContain(
      'http://localhost:8108/multi_search?q=shoes&per_page=5',
    );
    expect(toCurl(request, node)).toContain('"query_by": "title,brand"');
    expect(toTypesenseJs(request, node)).toContain('client.multiSearch.perform');
    const adapter = toInstantSearchAdapter(request, node);
    expect(adapter).toContain('collectionSpecificSearchParameters');
    expect(adapter).toContain('"products"');
    expect(adapter).not.toContain('"q"');
  });

  it('escapes single quotes in curl bodies', () => {
    const r = buildRequest(
      config({ searches: [search({ params: { filter_by: "name:='O'Brien'" } })] }),
    );
    expect(toCurl(r, node)).toContain(`'\\''`);
  });
});

describe('defaults', () => {
  it('starts empty', () => {
    expect(defaultConfig()).toEqual({ q: '', common: {}, searches: [] });
  });
});
