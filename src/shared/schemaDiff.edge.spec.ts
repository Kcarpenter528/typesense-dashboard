import { describe, expect, it } from 'vitest';
import type { CollectionFieldSchema } from 'typesense/lib/Typesense/Collection';
import {
  buildCreateSchema,
  cleanField,
  diffSchema,
  fieldsEqual,
  normalizeField,
  stableStringify,
} from './schemaDiff';

/*
 * Edge cases for the schema diff, plus a randomized check that the update it builds,
 * applied the way Typesense applies a `PATCH /collections/:name`, turns the original
 * schema into the edited one without touching fields that did not change.
 */

function serverField(name: string, type: string, extra: Record<string, unknown> = {}) {
  return {
    facet: false,
    index: true,
    infix: false,
    locale: '',
    name,
    optional: false,
    sort: ['int32', 'int64', 'float', 'bool', 'geopoint'].includes(type),
    stem: false,
    stem_dictionary: '',
    store: true,
    truncate_len: 100,
    type,
    ...extra,
  };
}

function serverCollection(overrides: Record<string, unknown> = {}) {
  return {
    name: 'jobs',
    created_at: 1790724647,
    num_documents: 3,
    curation_sets: [],
    default_sorting_field: '',
    enable_nested_fields: false,
    symbols_to_index: [],
    synonym_sets: [],
    token_separators: [],
    fields: [
      serverField('title', 'string'),
      serverField('status', 'string', { facet: true }),
      serverField('dueDate', 'int64'),
    ],
    ...overrides,
  } as Record<string, any>;
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

describe('stableStringify', () => {
  it('ignores object key order but not array order', () => {
    expect(stableStringify({ a: 1, b: { c: 2, d: 3 } })).toBe(
      stableStringify({ b: { d: 3, c: 2 }, a: 1 }),
    );
    expect(stableStringify(['a', 'b'])).not.toBe(stableStringify(['b', 'a']));
  });

  it('treats undefined as null', () => {
    expect(stableStringify(undefined)).toBe('null');
    expect(stableStringify([undefined])).toBe('[null]');
  });
});

describe('field normalization', () => {
  it('cleanField drops empty values and keys that are not part of a definition', () => {
    const field = {
      name: 'a',
      type: 'string',
      locale: '',
      reference: null,
      nested: true,
      nested_array: 1,
      drop: true,
      facet: false,
    } as unknown as CollectionFieldSchema;
    expect(cleanField(field)).toEqual({ name: 'a', type: 'string', facet: false });
  });

  it('normalizeField fills in server defaults, including sort by type', () => {
    expect(normalizeField({ name: 'n', type: 'int32' }).sort).toBe(true);
    expect(normalizeField({ name: 's', type: 'string' }).sort).toBe(false);
    expect(normalizeField({ name: 'v', type: 'float[]', num_dim: 2 })).toMatchObject({
      vec_dist: 'cosine',
      hnsw_params: { M: 16, ef_construction: 200 },
    });
  });

  it('fieldsEqual treats explicit defaults and omitted defaults as the same', () => {
    expect(
      fieldsEqual(serverField('n', 'int32') as CollectionFieldSchema, {
        name: 'n',
        type: 'int32',
        sort: true,
        index: true,
        optional: false,
      }),
    ).toBe(true);
    expect(
      fieldsEqual(serverField('n', 'int32') as CollectionFieldSchema, {
        name: 'n',
        type: 'int32',
        sort: false,
      }),
    ).toBe(false);
  });
});

describe('diffSchema edge cases', () => {
  it('ignores a change in field order', () => {
    const original = serverCollection();
    const edited = clone(original);
    edited.fields.reverse();
    expect(diffSchema(original, edited).hasChanges).toBe(false);
  });

  it('treats a renamed field as a drop plus an add', () => {
    const original = serverCollection();
    const edited = clone(original);
    edited.fields[0] = { name: 'headline', type: 'string' };
    const plan = diffSchema(original, edited);
    expect(plan.dropped).toEqual(['title']);
    expect(plan.added.map((f) => f.name)).toEqual(['headline']);
    expect(plan.modified).toEqual([]);
  });

  it('reports the type change and the sort default that follows from it', () => {
    const original = serverCollection();
    const edited = clone(original);
    edited.fields[2] = { name: 'dueDate', type: 'string' };
    const [change] = diffSchema(original, edited).modified;
    expect(change?.changes).toEqual([
      { key: 'sort', before: true, after: false },
      { key: 'type', before: 'int64', after: 'string' },
    ]);
  });

  it('requires nested fields when an existing field becomes an object', () => {
    const original = serverCollection();
    const edited = clone(original);
    edited.fields[1] = { name: 'status', type: 'object' };
    const plan = diffSchema(original, edited);
    expect(plan.requiresRecreate).toBe(true);
    expect(plan.createOnly.map((c) => c.key)).toEqual(['enable_nested_fields']);
  });

  it('orders operations as drops, then drop-and-re-add pairs, then adds', () => {
    const original = serverCollection();
    const edited = clone(original);
    edited.fields = [
      { ...edited.fields[1], facet: false }, // status: modified
      edited.fields[2], // dueDate: unchanged
      { name: 'owner', type: 'string' }, // added
    ]; // title: dropped
    expect(diffSchema(original, edited).payload?.fields).toEqual([
      { name: 'title', drop: true },
      { name: 'status', drop: true },
      expect.objectContaining({ name: 'status', facet: false }),
      { name: 'owner', type: 'string' },
    ]);
  });

  it('never sends unchanged fields', () => {
    const original = serverCollection();
    const edited = clone(original);
    edited.fields.push({ name: 'owner', type: 'string' });
    const names = (diffSchema(original, edited).payload?.fields ?? []).map((f) => f.name);
    expect(names).toEqual(['owner']);
  });

  it('ignores keys the server adds to fields in some responses', () => {
    const original = serverCollection({
      enable_nested_fields: true,
      fields: [serverField('customer', 'object', { nested: true, nested_array: 0 })],
    });
    const edited = clone(original);
    edited.fields[0] = { name: 'customer', type: 'object' };
    expect(diffSchema(original, edited).hasChanges).toBe(false);
  });

  it('compares metadata by value, not key order', () => {
    const original = serverCollection({ metadata: { owner: 'a', tier: { level: 1, x: 2 } } });
    const edited = clone(original);
    edited.metadata = { tier: { x: 2, level: 1 }, owner: 'a' };
    expect(diffSchema(original, edited).hasChanges).toBe(false);
    edited.metadata.tier.level = 2;
    expect(diffSchema(original, edited).settings.map((s) => s.key)).toEqual(['metadata']);
  });

  it('treats settings a server leaves out as their defaults', () => {
    // Servers before v30 do not return synonym_sets or curation_sets.
    const original = serverCollection();
    delete original.synonym_sets;
    delete original.curation_sets;
    const edited = clone(original);
    edited.synonym_sets = [];
    edited.curation_sets = [];
    expect(diffSchema(original, edited).hasChanges).toBe(false);
  });

  it('can clear the linked synonym sets in place', () => {
    const original = serverCollection({ synonym_sets: ['brands'] });
    const edited = clone(original);
    edited.synonym_sets = [];
    const plan = diffSchema(original, edited);
    expect(plan.payload).toEqual({ synonym_sets: [] });
    expect(plan.requiresRecreate).toBe(false);
  });

  it('keeps in-place settings in the payload when a recreate is also needed', () => {
    const original = serverCollection();
    const edited = clone(original);
    edited.metadata = { owner: 'a' };
    edited.token_separators = ['/'];
    const plan = diffSchema(original, edited);
    expect(plan.requiresRecreate).toBe(true);
    expect(plan.payload).toEqual({ metadata: { owner: 'a' } });
  });

  it('ignores read-only server state', () => {
    const original = serverCollection();
    const edited = clone(original);
    edited.num_documents = 999;
    edited.created_at = 1;
    expect(diffSchema(original, edited).hasChanges).toBe(false);
  });

  it('reports a missing fields array', () => {
    const original = serverCollection();
    const edited = clone(original);
    delete edited.fields;
    expect(diffSchema(original, edited).errors).toEqual([
      'The schema must contain a `fields` array.',
    ]);
  });

  it('reports a field without a type', () => {
    const original = serverCollection();
    const edited = clone(original);
    edited.fields.push({ name: 'owner' });
    expect(diffSchema(original, edited).errors).toEqual(['Field `owner` has no type.']);
  });

  it('does not modify its inputs', () => {
    const original = serverCollection();
    const edited = clone(original);
    edited.fields.push({ name: 'customer', type: 'object', locale: '' });
    edited.fields[0].facet = true;
    const originalCopy = clone(original);
    const editedCopy = clone(edited);
    diffSchema(original, edited);
    expect(original).toEqual(originalCopy);
    expect(edited).toEqual(editedCopy);
  });
});

describe('buildCreateSchema edge cases', () => {
  it('keeps a default sorting field that is set', () => {
    const schema = serverCollection({ default_sorting_field: 'dueDate' });
    expect(buildCreateSchema(schema, 'jobs').default_sorting_field).toBe('dueDate');
  });

  it('keeps settings and leaves nested fields off when no field needs them', () => {
    const schema = serverCollection({ metadata: { owner: 'a' }, token_separators: ['/'] });
    const created = buildCreateSchema(schema, 'jobs') as Record<string, any>;
    expect(created.enable_nested_fields).toBe(false);
    expect(created.metadata).toEqual({ owner: 'a' });
    expect(created.token_separators).toEqual(['/']);
  });

  it('does not modify its input', () => {
    const schema = serverCollection();
    const copy = clone(schema);
    buildCreateSchema(schema, 'other');
    expect(schema).toEqual(copy);
  });
});

/*
 * Randomized check. Each run makes a random edit to a random schema, diffs it, and
 * applies the payload the way Typesense does: operations run in order, a drop needs
 * the field to exist, and an add needs the name to be free.
 */

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TYPES = ['string', 'string[]', 'int32', 'int64', 'float', 'bool'];

function applyPatch(fields: CollectionFieldSchema[], ops: Record<string, unknown>[]) {
  const result = new Map(fields.map((f) => [f.name, f]));
  for (const op of ops) {
    const name = op.name as string;
    if (op.drop) {
      if (!result.has(name)) throw new Error(`drop of missing field ${name}`);
      result.delete(name);
    } else {
      if (result.has(name)) throw new Error(`add of existing field ${name}`);
      result.set(name, op as unknown as CollectionFieldSchema);
    }
  }
  return result;
}

describe('diffSchema randomized', () => {
  it('builds a payload that turns the original into the edited schema', () => {
    const random = mulberry32(30_2);
    const pick = <T>(items: T[]) => items[Math.floor(random() * items.length)] as T;

    for (let run = 0; run < 300; run++) {
      const count = 1 + Math.floor(random() * 6);
      const original = serverCollection({
        fields: Array.from({ length: count }, (_, i) =>
          serverField(`f${i}`, pick(TYPES), { facet: random() < 0.3, optional: random() < 0.3 }),
        ),
      });
      const edited = clone(original);
      let fields = edited.fields as Record<string, unknown>[];
      const untouched = new Set(fields.map((f) => f.name as string));

      const edits = 1 + Math.floor(random() * 4);
      for (let e = 0; e < edits; e++) {
        const action = pick(['add', 'drop', 'modify', 'rename', 'reorder']);
        const target = fields.length ? pick(fields) : undefined;
        if (action === 'add' || !target) {
          fields.push({ name: `n${run}_${e}`, type: pick(TYPES) });
        } else if (action === 'drop') {
          fields = fields.filter((f) => f !== target);
          untouched.delete(target.name as string);
        } else if (action === 'modify') {
          target[pick(['facet', 'optional', 'index', 'sort'])] = random() < 0.5;
          untouched.delete(target.name as string);
        } else if (action === 'rename') {
          untouched.delete(target.name as string);
          target.name = `r${run}_${e}`;
        } else {
          fields.reverse();
        }
      }
      edited.fields = fields;

      const plan = diffSchema(original, edited);
      const context = `run ${run}: ${JSON.stringify(edited.fields)}`;
      expect(plan.errors, context).toEqual([]);
      expect(plan.requiresRecreate, context).toBe(false);

      const ops = (plan.payload?.fields ?? []) as Record<string, unknown>[];
      const result = applyPatch(original.fields as CollectionFieldSchema[], ops);
      expect([...result.keys()].sort(), context).toEqual(
        fields.map((f) => f.name as string).sort(),
      );
      for (const field of fields as unknown as CollectionFieldSchema[]) {
        expect(fieldsEqual(result.get(field.name)!, field), context).toBe(true);
      }

      // Fields whose definition did not change are never dropped or re-sent.
      const opNames = new Set(ops.map((o) => o.name as string));
      for (const name of untouched) {
        const before = (original.fields as CollectionFieldSchema[]).find((f) => f.name === name)!;
        const after = (fields as unknown as CollectionFieldSchema[]).find((f) => f.name === name)!;
        if (fieldsEqual(before, after)) expect(opNames.has(name), context).toBe(false);
      }

      // Diffing the edited schema against itself finds nothing left to do.
      expect(diffSchema(edited, clone(edited)).hasChanges, context).toBe(false);
    }
  });
});
