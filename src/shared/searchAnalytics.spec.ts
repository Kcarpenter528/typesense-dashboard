import { describe, expect, it } from 'vitest';
import type { AnalyticsRuleSchema } from 'typesense/lib/Typesense/AnalyticsRule';
import {
  counterSources,
  counterWords,
  labelField,
  queryRows,
  querySources,
  statusRows,
  truncate,
} from './searchAnalytics';

function rule(name: string, type: string, destination?: string, collection = 'products') {
  return {
    name,
    type,
    collection,
    event_type: 'search',
    params: destination ? { destination_collection: destination } : {},
  } as unknown as AnalyticsRuleSchema;
}

describe('querySources', () => {
  it('keeps only rules that write search terms, popular ones first', () => {
    const sources = querySources([
      rule('empty', 'nohits_queries', 'nohits'),
      rule('clicks', 'counter', 'products'),
      rule('raw', 'log'),
      rule('top', 'popular_queries', 'queries'),
    ]);
    expect(sources.map((s) => [s.kind, s.destination])).toEqual([
      ['popular', 'queries'],
      ['nohits', 'nohits'],
    ]);
  });

  it('merges rules that share a destination', () => {
    const sources = querySources([
      rule('a', 'popular_queries', 'queries'),
      rule('b', 'popular_queries', 'queries'),
    ]);
    expect(sources).toHaveLength(1);
    expect(sources[0]!.rules).toEqual(['a', 'b']);
  });

  it('skips rules with no destination', () => {
    expect(querySources([rule('a', 'popular_queries')])).toEqual([]);
  });
});

describe('queryRows', () => {
  it('reads q and count and drops malformed documents', () => {
    expect(
      queryRows([
        { document: { q: 'shoes', count: 4 } },
        { document: { q: '  ', count: 2 } },
        { document: { q: 'hat', count: '3' } },
        {},
      ]),
    ).toEqual([{ q: 'shoes', count: 4 }]);
    expect(queryRows(undefined)).toEqual([]);
  });
});

describe('truncate', () => {
  it('shortens long labels only', () => {
    expect(truncate('short')).toBe('short');
    expect(truncate('a'.repeat(40), 10)).toBe(`${'a'.repeat(9)}…`);
  });
});

describe('counterSources', () => {
  it('reads the counted collection and field from counter rules', () => {
    const counter = {
      ...rule('clicks', 'counter', 'products'),
      params: { destination_collection: 'products', counter_field: 'clicks' },
    } as unknown as AnalyticsRuleSchema;
    const [source] = counterSources([counter, rule('top', 'popular_queries', 'queries')]);
    expect(source).toMatchObject({ destination: 'products', counterField: 'clicks' });
    expect(counterWords({ ...source!, eventType: 'click' }).heading).toBe('Most clicked documents');
    expect(counterWords({ ...source!, eventType: '' }).unit).toBe('clicks');
  });

  it('skips counter rules without a field', () => {
    expect(counterSources([rule('c', 'counter', 'products')])).toEqual([]);
  });
});

describe('labelField', () => {
  const fields = [
    { name: 'sku', type: 'string' },
    { name: 'title', type: 'string' },
    { name: 'clicks', type: 'int32' },
  ];
  it('prefers a title-like field, else the first string field', () => {
    expect(labelField(fields, 'clicks')).toBe('title');
    expect(labelField([fields[0]!, fields[2]!], 'clicks')).toBe('sku');
    expect(labelField([fields[2]!], 'clicks')).toBeUndefined();
  });
});

describe('statusRows', () => {
  it('names the non-zero counters, biggest first', () => {
    expect(
      statusRows({ query_log_events: 3, doc_counter_events: 9, log_prefix_queries: 0 }),
    ).toEqual([
      { q: 'Document counter updates', count: 9 },
      { q: 'Search events logged', count: 3 },
    ]);
    expect(statusRows(undefined)).toEqual([]);
  });
});
