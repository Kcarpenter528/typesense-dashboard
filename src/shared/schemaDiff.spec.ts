import { describe, expect, it } from 'vitest';
import { buildCreateSchema, diffSchema } from './schemaDiff';

// Shaped like a real `GET /collections/:name` response from Typesense 30.2.
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
    name: 'milestones',
    created_at: 1790724647,
    num_documents: 12,
    curation_sets: [],
    default_sorting_field: '',
    enable_nested_fields: false,
    symbols_to_index: [],
    synonym_sets: [],
    token_separators: [],
    fields: [serverField('Id', 'string'), serverField('count', 'int32')],
    ...overrides,
  } as Record<string, any>;
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

describe('diffSchema', () => {
  it('reports no changes for an untouched schema', () => {
    const original = serverCollection();
    const plan = diffSchema(original, clone(original));
    expect(plan.hasChanges).toBe(false);
    expect(plan.payload).toBeNull();
    expect(plan.errors).toEqual([]);
  });

  it('treats a field typed without server defaults as unchanged', () => {
    const original = serverCollection();
    const edited = clone(original);
    edited.fields[0] = { name: 'Id', type: 'string' };
    edited.fields[1] = { name: 'count', type: 'int32', locale: '', stem_dictionary: '' };
    expect(diffSchema(original, edited).hasChanges).toBe(false);
  });

  it('adds a new field without touching existing ones', () => {
    const original = serverCollection();
    const edited = clone(original);
    edited.fields.push({ name: 'note', type: 'string', optional: true, locale: '' });
    const plan = diffSchema(original, edited);
    expect(plan.payload).toEqual({ fields: [{ name: 'note', type: 'string', optional: true }] });
    expect(plan.requiresRecreate).toBe(false);
  });

  it('modifies a field by dropping and re-adding only that field', () => {
    const original = serverCollection();
    const edited = clone(original);
    edited.fields[0].facet = true;
    const plan = diffSchema(original, edited);
    expect(plan.modified).toHaveLength(1);
    expect(plan.modified[0]?.changes).toEqual([{ key: 'facet', before: false, after: true }]);
    expect(plan.payload?.fields).toEqual([
      { name: 'Id', drop: true },
      expect.objectContaining({ name: 'Id', type: 'string', facet: true }),
    ]);
  });

  it('drops removed fields', () => {
    const original = serverCollection();
    const edited = clone(original);
    edited.fields.splice(1, 1);
    expect(diffSchema(original, edited).payload).toEqual({
      fields: [{ name: 'count', drop: true }],
    });
  });

  it('flags enable_nested_fields as create-only (the reported bug)', () => {
    const original = serverCollection();
    const edited = clone(original);
    edited.enable_nested_fields = true;
    edited.fields.push({ name: 'kineticCustomer', type: 'object', optional: true });
    edited.fields.push({ name: 'milestoneTasks', type: 'object[]' });
    const plan = diffSchema(original, edited);
    expect(plan.requiresRecreate).toBe(true);
    expect(plan.createOnly).toEqual([{ key: 'enable_nested_fields', before: false, after: true }]);
  });

  it('requires nested fields when an object field is added to a collection without them', () => {
    const original = serverCollection();
    const edited = clone(original);
    edited.fields.push({ name: 'customer', type: 'object' });
    const plan = diffSchema(original, edited);
    expect(plan.requiresRecreate).toBe(true);
    expect(plan.createOnly[0]).toMatchObject({ key: 'enable_nested_fields', after: true });
    expect(plan.createOnly[0]?.reason).toBeTruthy();
  });

  it('adds object fields in place when nested fields are already enabled', () => {
    const original = serverCollection({ enable_nested_fields: true });
    const edited = clone(original);
    edited.fields.push({ name: 'customer', type: 'object', optional: true });
    const plan = diffSchema(original, edited);
    expect(plan.requiresRecreate).toBe(false);
    expect(plan.payload?.fields).toEqual([{ name: 'customer', type: 'object', optional: true }]);
  });

  it('leaves auto-generated nested child fields alone', () => {
    const original = serverCollection({
      enable_nested_fields: true,
      fields: [
        serverField('customer', 'object'),
        serverField('customer.name', 'string', { optional: true }),
        serverField('customer.num', 'int64', { optional: true }),
      ],
    });
    const edited = clone(original);
    edited.fields[0].optional = true;
    const plan = diffSchema(original, edited);
    expect(plan.payload?.fields).toEqual([
      { name: 'customer', drop: true },
      expect.objectContaining({ name: 'customer', optional: true }),
    ]);
  });

  it('updates metadata and synonym sets in place', () => {
    const original = serverCollection();
    const edited = clone(original);
    edited.metadata = { owner: 'search-team' };
    edited.synonym_sets = ['brands'];
    const plan = diffSchema(original, edited);
    expect(plan.requiresRecreate).toBe(false);
    expect(plan.payload).toEqual({ metadata: { owner: 'search-team' }, synonym_sets: ['brands'] });
  });

  it('treats other collection settings as create-only', () => {
    const original = serverCollection();
    const edited = clone(original);
    edited.token_separators = ['-'];
    edited.default_sorting_field = 'count';
    const plan = diffSchema(original, edited);
    expect(plan.createOnly.map((c) => c.key)).toEqual([
      'default_sorting_field',
      'token_separators',
    ]);
    expect(plan.payload).toBeNull();
  });

  it('ignores settings missing from the edited schema', () => {
    const original = serverCollection({ token_separators: ['-'] });
    const edited = clone(original);
    delete edited.token_separators;
    delete edited.curation_sets;
    expect(diffSchema(original, edited).hasChanges).toBe(false);
  });

  it('strips num_dim unless the field is a vector', () => {
    const original = serverCollection();
    const edited = clone(original);
    edited.fields.push({ name: 'tags', type: 'string[]', num_dim: 0 });
    edited.fields.push({ name: 'vec', type: 'float[]', num_dim: 3 });
    const fields = diffSchema(original, edited).payload?.fields;
    expect(fields?.[0]).toEqual({ name: 'tags', type: 'string[]' });
    expect(fields?.[1]).toEqual({ name: 'vec', type: 'float[]', num_dim: 3 });
  });

  it('does not treat server-filled vector defaults as a change', () => {
    const original = serverCollection({
      fields: [
        serverField('vec', 'float[]', {
          num_dim: 3,
          optional: true,
          vec_dist: 'cosine',
          hnsw_params: { M: 16, ef_construction: 200 },
        }),
      ],
    });
    const edited = clone(original);
    edited.fields[0] = { name: 'vec', type: 'float[]', num_dim: 3, optional: true };
    expect(diffSchema(original, edited).hasChanges).toBe(false);
  });

  it('reports validation errors', () => {
    const original = serverCollection();
    const edited = clone(original);
    edited.name = 'renamed';
    edited.fields.push({ name: 'Id', type: 'string' });
    edited.fields.push({ name: '', type: 'string' });
    const { errors } = diffSchema(original, edited);
    expect(errors).toHaveLength(3);
  });

  it('refuses to change the id field', () => {
    const original = serverCollection();
    const edited = clone(original);
    edited.fields.push({ name: 'id', type: 'string' });
    expect(diffSchema(original, edited).errors).toContain('The `id` field cannot be changed.');
  });
});

describe('buildCreateSchema', () => {
  it('strips server state, cleans fields and enables nested fields when needed', () => {
    const schema = serverCollection();
    schema.fields.push({ name: 'customer', type: 'object', num_dim: 0, locale: '' });
    const created = buildCreateSchema(schema, 'milestones_tmp') as Record<string, any>;
    expect(created.name).toBe('milestones_tmp');
    expect(created.created_at).toBeUndefined();
    expect(created.num_documents).toBeUndefined();
    expect(created.default_sorting_field).toBeUndefined();
    expect(created.enable_nested_fields).toBe(true);
    expect(created.fields[2]).toEqual({ name: 'customer', type: 'object' });
  });
});
