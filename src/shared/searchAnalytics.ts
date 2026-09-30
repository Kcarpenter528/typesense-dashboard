import type { AnalyticsRuleSchema } from 'typesense/lib/Typesense/AnalyticsRule';

export type QueryKind = 'popular' | 'nohits';

/** A collection that an analytics rule fills with search terms and their counts. */
export interface QuerySource {
  kind: QueryKind;
  /** The collection the rule listens to, for display. */
  collection: string;
  /** The collection holding `q` and `count` documents. */
  destination: string;
  /** Every rule feeding this destination. */
  rules: string[];
}

export interface QueryRow {
  q: string;
  count: number;
}

const KINDS: Record<string, QueryKind> = {
  popular_queries: 'popular',
  nohits_queries: 'nohits',
};

/**
 * The query collections worth charting. Counter and log rules don't hold search terms,
 * and rules that share a destination are one source.
 */
export function querySources(rules: AnalyticsRuleSchema[]): QuerySource[] {
  const sources = new Map<string, QuerySource>();
  for (const rule of rules) {
    const kind = KINDS[rule.type];
    const destination = (rule.params as { destination_collection?: string } | undefined)
      ?.destination_collection;
    if (!kind || !destination) continue;
    const key = `${kind}:${destination}`;
    const existing = sources.get(key);
    if (existing) {
      existing.rules.push(rule.name);
    } else {
      sources.set(key, {
        kind,
        collection: rule.collection ?? '',
        destination,
        rules: [rule.name],
      });
    }
  }
  // Popular searches first, then the no-result ones.
  return [...sources.values()].sort(
    (a, b) => Number(a.kind === 'nohits') - Number(b.kind === 'nohits'),
  );
}

/** Search hits from a query collection as rows, dropping documents without a usable term. */
export function queryRows(hits: { document?: object }[] | undefined): QueryRow[] {
  const rows: QueryRow[] = [];
  for (const hit of hits ?? []) {
    const { q, count } = (hit.document ?? {}) as Record<string, unknown>;
    if (typeof q === 'string' && q.trim() && typeof count === 'number') {
      rows.push({ q, count });
    }
  }
  return rows;
}

/** Shortens a label for a chart axis, keeping the full text for the tooltip. */
export function truncate(text: string, max = 28): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** A rule that adds up clicks, conversions or visits on the documents of a collection. */
export interface CounterSource {
  rule: string;
  /** The collection being counted (where the counter field lives). */
  destination: string;
  counterField: string;
  eventType: string;
}

export function counterSources(rules: AnalyticsRuleSchema[]): CounterSource[] {
  const sources = new Map<string, CounterSource>();
  for (const rule of rules) {
    if (rule.type !== 'counter') continue;
    const params = rule.params as { destination_collection?: string; counter_field?: string };
    if (!params?.destination_collection || !params.counter_field) continue;
    const key = `${params.destination_collection}:${params.counter_field}`;
    if (!sources.has(key)) {
      sources.set(key, {
        rule: rule.name,
        destination: params.destination_collection,
        counterField: params.counter_field,
        eventType: (rule as { event_type?: string }).event_type ?? '',
      });
    }
  }
  return [...sources.values()];
}

const COUNTER_WORDS: Record<string, { heading: string; unit: string }> = {
  click: { heading: 'Most clicked documents', unit: 'clicks' },
  conversion: { heading: 'Top converting documents', unit: 'conversions' },
  visit: { heading: 'Most visited documents', unit: 'visits' },
};

export function counterWords(source: CounterSource): { heading: string; unit: string } {
  return (
    COUNTER_WORDS[source.eventType] ?? {
      heading: `Top documents by ${source.counterField}`,
      unit: source.counterField,
    }
  );
}

/**
 * The field that best names a document in a chart: a conventional title field, else
 * the first string field, else nothing (the document id is used).
 */
export function labelField(
  fields: { name: string; type: string }[] | undefined,
  counterField: string,
): string | undefined {
  const strings = (fields ?? []).filter((f) => f.type === 'string' && f.name !== counterField);
  const preferred = ['title', 'name', 'label', 'headline'];
  return preferred.find((name) => strings.some((f) => f.name === name)) ?? strings[0]?.name;
}

/** Human names for the counters `/analytics/status` reports, in display order. */
const STATUS_LABELS: [string, string][] = [
  ['query_log_events', 'Search events logged'],
  ['doc_log_events', 'Click and conversion events logged'],
  ['query_counter_events', 'Query counter updates'],
  ['doc_counter_events', 'Document counter updates'],
  ['popular_prefix_queries', 'Popular-search queries seen'],
  ['nohits_prefix_queries', 'No-result queries seen'],
  ['log_prefix_queries', 'Queries logged'],
];

/** The non-zero counters from `/analytics/status`, biggest first. */
export function statusRows(status: Record<string, unknown> | undefined): QueryRow[] {
  const rows: QueryRow[] = [];
  for (const [key, label] of STATUS_LABELS) {
    const value = status?.[key];
    if (typeof value === 'number' && value > 0) rows.push({ q: label, count: value });
  }
  return rows.sort((a, b) => b.count - a.count);
}
