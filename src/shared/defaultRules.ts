import type { AnalyticsRuleCreateSchema } from 'typesense/lib/Typesense/AnalyticsRule';
import type { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';

export interface DefaultRulesOptions {
  popular: boolean;
  nohits: boolean;
}

export type PlanStep =
  | { kind: 'collection'; name: string; exists: boolean; schema: CollectionCreateSchema }
  | { kind: 'rule'; name: string; exists: boolean; rule: AnalyticsRuleCreateSchema };

/** Documents hold a search term and how often it was searched. */
function queryCollection(name: string): CollectionCreateSchema {
  return {
    name,
    fields: [
      { name: 'q', type: 'string' },
      { name: 'count', type: 'int32' },
    ],
  };
}

/**
 * What it takes to start collecting popular and no-result searches for a collection:
 * a destination collection for each, and a rule that fills it. Anything that already
 * exists is reused and left as it is, so running this twice never overwrites a rule.
 */
export function planDefaultRules(
  source: string,
  options: DefaultRulesOptions,
  existingCollections: string[],
  existingRules: string[],
): PlanStep[] {
  const kinds = [
    { on: options.popular, type: 'popular_queries', suffix: 'popular' },
    { on: options.nohits, type: 'nohits_queries', suffix: 'nohits' },
  ] as const;

  const steps: PlanStep[] = [];
  for (const kind of kinds) {
    if (!kind.on) continue;
    const destination = `${source}_${kind.suffix}_queries`;
    const ruleName = `${source}_${kind.suffix}`;
    steps.push({
      kind: 'collection',
      name: destination,
      exists: existingCollections.includes(destination),
      schema: queryCollection(destination),
    });
    steps.push({
      kind: 'rule',
      name: ruleName,
      exists: existingRules.includes(ruleName),
      rule: {
        name: ruleName,
        type: kind.type,
        collection: source,
        event_type: 'search',
        params: { destination_collection: destination, limit: 1000, expand_query: false },
      },
    });
  }
  return steps;
}

export interface RulesApi {
  createCollection(schema: CollectionCreateSchema): Promise<unknown> | undefined;
  upsertAnalyticsRule(name: string, rule: AnalyticsRuleCreateSchema): Promise<unknown> | undefined;
}

/** Runs the steps in order (collections come before the rules that write to them). */
export async function applyPlan(api: RulesApi, steps: PlanStep[]): Promise<void> {
  for (const step of steps) {
    if (step.exists) continue;
    if (step.kind === 'collection') await api.createCollection(step.schema);
    else await api.upsertAnalyticsRule(step.name, step.rule);
  }
}
