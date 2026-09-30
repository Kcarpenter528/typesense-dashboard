import { describe, expect, it, vi } from 'vitest';
import { applyPlan, planDefaultRules } from './defaultRules';

describe('planDefaultRules', () => {
  it('plans a collection then a rule for each kind', () => {
    const steps = planDefaultRules('products', { popular: true, nohits: true }, [], []);
    expect(steps.map((s) => `${s.kind}:${s.name}`)).toEqual([
      'collection:products_popular_queries',
      'rule:products_popular',
      'collection:products_nohits_queries',
      'rule:products_nohits',
    ]);
    const rule = steps[1]!;
    expect(rule.kind === 'rule' && rule.rule).toMatchObject({
      type: 'popular_queries',
      collection: 'products',
      event_type: 'search',
      params: { destination_collection: 'products_popular_queries' },
    });
  });

  it('plans only what was asked for', () => {
    const steps = planDefaultRules('p', { popular: false, nohits: true }, [], []);
    expect(steps.map((s) => s.name)).toEqual(['p_nohits_queries', 'p_nohits']);
  });

  it('marks existing collections and rules so they are kept', () => {
    const steps = planDefaultRules(
      'p',
      { popular: true, nohits: false },
      ['p_popular_queries'],
      ['p_popular'],
    );
    expect(steps.map((s) => s.exists)).toEqual([true, true]);
  });
});

describe('applyPlan', () => {
  it('creates only what is missing, collections first', async () => {
    const calls: string[] = [];
    const api = {
      createCollection: vi.fn((schema: { name: string }) => {
        calls.push(`collection ${schema.name}`);
        return Promise.resolve();
      }),
      upsertAnalyticsRule: vi.fn((name: string) => {
        calls.push(`rule ${name}`);
        return Promise.resolve();
      }),
    };
    const steps = planDefaultRules('p', { popular: true, nohits: true }, ['p_popular_queries'], []);
    await applyPlan(api, steps);
    expect(calls).toEqual(['rule p_popular', 'collection p_nohits_queries', 'rule p_nohits']);
  });
});
