import type {
  CollectionDropFieldSchema,
  CollectionFieldSchema,
  CollectionUpdateSchema,
} from 'typesense/lib/Typesense/Collection';
import type { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';

/**
 * Collection settings that `PATCH /collections/:name` accepts (Typesense v30).
 */
export const UPDATABLE_COLLECTION_KEYS = ['metadata', 'synonym_sets', 'curation_sets'] as const;

/**
 * Keys returned by `GET /collections/:name` that are read-only server state, not settings.
 */
const SERVER_ONLY_COLLECTION_KEYS = ['created_at', 'num_documents', 'num_memory_shards'];

/**
 * Keys the server attaches to fields in some responses that are not part of the field definition.
 */
const IGNORED_FIELD_KEYS = ['nested', 'nested_array', 'drop'];

/**
 * Scalar types for which Typesense enables `sort` unless told otherwise.
 */
const SORTABLE_BY_DEFAULT_TYPES = ['int32', 'int64', 'float', 'bool', 'geopoint'];

export interface ValueChange {
  key: string;
  before: unknown;
  after: unknown;
  /** Set when the change was not typed by the user but is required by other changes. */
  reason?: string;
}

export interface FieldModification {
  name: string;
  before: CollectionFieldSchema;
  after: CollectionFieldSchema;
  changes: ValueChange[];
}

export interface SchemaChangePlan {
  added: CollectionFieldSchema[];
  modified: FieldModification[];
  dropped: string[];
  /** Collection settings that can be updated in place. */
  settings: ValueChange[];
  /** Collection settings that can only be set at creation; any entry here requires recreating the collection. */
  createOnly: ValueChange[];
  errors: string[];
  /** The `PATCH` body for an in-place update, or null when there is nothing to update in place. */
  payload: CollectionUpdateSchema | null;
  hasChanges: boolean;
  requiresRecreate: boolean;
}

/** Any collection schema shape: a server response, an edited schema or parsed JSON. */
export type SchemaLike = object;
type SchemaRecord = Record<string, unknown> & { name?: unknown; fields?: unknown };

export function isObjectType(type: unknown): boolean {
  return type === 'object' || type === 'object[]';
}

/**
 * Stable JSON serialization (sorted object keys) used for equality checks.
 */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.keys(value as Record<string, unknown>)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

function fieldDefaults(field: CollectionFieldSchema): Record<string, unknown> {
  const defaults: Record<string, unknown> = {
    facet: false,
    optional: false,
    index: true,
    sort: SORTABLE_BY_DEFAULT_TYPES.includes(field.type),
    infix: false,
    locale: '',
    stem: false,
    stem_dictionary: '',
    store: true,
    truncate_len: 100,
    range_index: false,
  };
  if (field.num_dim) {
    defaults.vec_dist = 'cosine';
    defaults.hnsw_params = { M: 16, ef_construction: 200 };
  }
  return defaults;
}

/**
 * Removes empty values and keys that are not part of a field definition.
 * The result is what gets sent to the server when (re)adding a field.
 */
export function cleanField(field: CollectionFieldSchema): CollectionFieldSchema {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(field)) {
    if (IGNORED_FIELD_KEYS.includes(key) || isEmpty(value)) continue;
    if (key === 'num_dim' && (field.type !== 'float[]' || !value)) continue;
    cleaned[key] = value;
  }
  return cleaned as CollectionFieldSchema;
}

/**
 * Fills in server defaults so a field as typed by the user compares equal to the
 * same field as returned by the server.
 */
export function normalizeField(field: CollectionFieldSchema): Record<string, unknown> {
  const cleaned = cleanField(field);
  return { ...fieldDefaults(cleaned), ...cleaned };
}

export function fieldsEqual(a: CollectionFieldSchema, b: CollectionFieldSchema): boolean {
  return stableStringify(normalizeField(a)) === stableStringify(normalizeField(b));
}

function diffFieldKeys(before: CollectionFieldSchema, after: CollectionFieldSchema): ValueChange[] {
  const a = normalizeField(before);
  const b = normalizeField(after);
  const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)])).sort();
  return keys
    .filter((key) => stableStringify(a[key]) !== stableStringify(b[key]))
    .map((key) => ({ key, before: a[key], after: b[key] }));
}

function settingDefault(key: string): unknown {
  switch (key) {
    case 'enable_nested_fields':
      return false;
    case 'default_sorting_field':
      return '';
    case 'token_separators':
    case 'symbols_to_index':
    case 'synonym_sets':
    case 'curation_sets':
      return [];
    case 'metadata':
      return {};
    default:
      return undefined;
  }
}

function settingValue(schema: SchemaRecord, key: string): unknown {
  const value = schema[key];
  return value === undefined || value === null ? settingDefault(key) : value;
}

function validateFields(fields: CollectionFieldSchema[]): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  fields.forEach((field, index) => {
    const name = typeof field?.name === 'string' ? field.name.trim() : '';
    if (!name) {
      errors.push(`Field #${index + 1} has no name.`);
      return;
    }
    if (!field.type) {
      errors.push(`Field \`${name}\` has no type.`);
    }
    if (seen.has(name)) {
      errors.push(`Field \`${name}\` is defined more than once.`);
    }
    seen.add(name);
  });
  return errors;
}

/**
 * Compares the schema currently on the server with an edited schema and works out
 * the minimal update. Fields that did not change are left alone, changed fields are
 * dropped and re-added in the same request (the only way Typesense supports
 * modifying a field), and settings that can only be set at creation are reported
 * in `createOnly` instead of being sent, since the server would reject them.
 */
export function diffSchema(originalSchema: SchemaLike, editedSchema: SchemaLike): SchemaChangePlan {
  const original = originalSchema as SchemaRecord;
  const edited = editedSchema as SchemaRecord;
  const originalFields = (original.fields ?? []) as CollectionFieldSchema[];
  const editedFields = (
    Array.isArray(edited.fields) ? edited.fields : []
  ) as CollectionFieldSchema[];

  const errors = Array.isArray(edited.fields)
    ? validateFields(editedFields)
    : ['The schema must contain a `fields` array.'];

  if (edited.name !== undefined && edited.name !== original.name) {
    errors.push('A collection cannot be renamed. Use an alias or clone the collection instead.');
  }

  const originalByName = new Map(originalFields.map((f) => [f.name, f]));
  const editedByName = new Map(editedFields.map((f) => [f.name, f]));

  const added: CollectionFieldSchema[] = [];
  const modified: FieldModification[] = [];
  const dropped: string[] = [];

  for (const field of editedFields) {
    const before = originalByName.get(field.name);
    if (!before) {
      added.push(field);
    } else if (!fieldsEqual(before, field)) {
      modified.push({
        name: field.name,
        before,
        after: field,
        changes: diffFieldKeys(before, field),
      });
    }
  }
  for (const field of originalFields) {
    if (!editedByName.has(field.name)) {
      dropped.push(field.name);
    }
  }

  const touched = [...added.map((f) => f.name), ...modified.map((m) => m.name), ...dropped];
  if (touched.includes('id')) {
    errors.push('The `id` field cannot be changed.');
  }

  const settings: ValueChange[] = [];
  const createOnly: ValueChange[] = [];
  const settingKeys = new Set(
    [...Object.keys(original), ...Object.keys(edited)].filter(
      (k) => k !== 'name' && k !== 'fields' && !SERVER_ONLY_COLLECTION_KEYS.includes(k),
    ),
  );
  for (const key of Array.from(settingKeys).sort()) {
    // A key left out of the edited schema means "leave as is", not "reset".
    if (!(key in edited)) continue;
    const before = settingValue(original, key);
    const after = settingValue(edited, key);
    if (stableStringify(before) === stableStringify(after)) continue;
    const change = { key, before, after };
    if ((UPDATABLE_COLLECTION_KEYS as readonly string[]).includes(key)) {
      settings.push(change);
    } else {
      createOnly.push(change);
    }
  }

  const introducesObjectField = [...added, ...modified.map((m) => m.after)].some((f) =>
    isObjectType(f.type),
  );
  const nestedEnabled = settingValue(original, 'enable_nested_fields') === true;
  if (
    introducesObjectField &&
    !nestedEnabled &&
    !createOnly.some((c) => c.key === 'enable_nested_fields')
  ) {
    createOnly.push({
      key: 'enable_nested_fields',
      before: false,
      after: true,
      reason: '`object` and `object[]` fields require nested fields to be enabled.',
    });
  }

  const fieldOps: (CollectionFieldSchema | CollectionDropFieldSchema)[] = [
    ...dropped.map((name) => ({ name, drop: true as const })),
    ...modified.flatMap((m) => [{ name: m.name, drop: true as const }, cleanField(m.after)]),
    ...added.map((f) => cleanField(f)),
  ];

  let payload: CollectionUpdateSchema | null = null;
  if (fieldOps.length || settings.length) {
    payload = {};
    if (fieldOps.length) payload.fields = fieldOps;
    for (const change of settings) {
      (payload as Record<string, unknown>)[change.key] = change.after;
    }
  }

  const hasChanges = Boolean(payload) || createOnly.length > 0;
  return {
    added,
    modified,
    dropped,
    settings,
    createOnly,
    errors,
    payload,
    hasChanges,
    requiresRecreate: createOnly.length > 0,
  };
}

/**
 * Builds the schema used to create a collection from scratch (for example when
 * recreating it to change a create-only setting).
 */
export function buildCreateSchema(schemaInput: SchemaLike, name: string): CollectionCreateSchema {
  const schema = schemaInput as SchemaRecord;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema)) {
    if (SERVER_ONLY_COLLECTION_KEYS.includes(key) || value === undefined || value === null)
      continue;
    result[key] = value;
  }
  result.name = name;
  const fields = ((schema.fields ?? []) as CollectionFieldSchema[]).map((f) => cleanField(f));
  result.fields = fields;
  if (fields.some((f) => isObjectType(f.type))) {
    result.enable_nested_fields = true;
  }
  if (result.default_sorting_field === '') {
    delete result.default_sorting_field;
  }
  return result as unknown as CollectionCreateSchema;
}
