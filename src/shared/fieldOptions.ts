import type { CollectionFieldSchema } from 'typesense/lib/Typesense/Collection';

export interface FieldTypeOption {
  value: string;
  label: string;
  description: string;
}

export const FIELD_TYPE_OPTIONS: FieldTypeOption[] = [
  { value: 'string', label: 'string', description: 'Text' },
  { value: 'string[]', label: 'string[]', description: 'List of text values' },
  { value: 'int32', label: 'int32', description: 'Integer up to ±2,147,483,647' },
  { value: 'int32[]', label: 'int32[]', description: 'List of int32' },
  { value: 'int64', label: 'int64', description: 'Large integer, e.g. timestamps' },
  { value: 'int64[]', label: 'int64[]', description: 'List of int64' },
  { value: 'float', label: 'float', description: 'Decimal number' },
  { value: 'float[]', label: 'float[]', description: 'List of floats, or a vector / embedding' },
  { value: 'bool', label: 'bool', description: 'true / false' },
  { value: 'bool[]', label: 'bool[]', description: 'List of booleans' },
  { value: 'geopoint', label: 'geopoint', description: '[latitude, longitude]' },
  { value: 'geopoint[]', label: 'geopoint[]', description: 'List of geopoints' },
  { value: 'geopolygon', label: 'geopolygon', description: 'Polygon of lat/lng points' },
  { value: 'object', label: 'object', description: 'Nested object (needs nested fields)' },
  { value: 'object[]', label: 'object[]', description: 'List of nested objects' },
  { value: 'string*', label: 'string*', description: 'String or string[], detected per document' },
  { value: 'image', label: 'image', description: 'Base64 image, for image embeddings' },
  { value: 'auto', label: 'auto', description: 'Type detected from the first document' },
];

export const VECTOR_DISTANCES = ['cosine', 'ip'];

export const BUILT_IN_EMBEDDING_MODELS = [
  'ts/all-MiniLM-L12-v2',
  'ts/e5-small',
  'ts/multilingual-e5-small',
  'ts/clip-vit-b-p32',
];

const STRING_TYPES = ['string', 'string[]', 'string*'];
const NUMERIC_TYPES = ['int32', 'int64', 'float', 'int32[]', 'int64[]', 'float[]'];
const SORTABLE_TYPES = ['int32', 'int64', 'float', 'bool', 'geopoint', 'geopoint[]', 'string'];
const REFERENCE_TYPES = ['string', 'int32', 'int64', 'string[]', 'int32[]', 'int64[]'];
const EMBED_SOURCE_TYPES = ['string', 'string[]', 'image'];

/** Types for which Typesense enables `sort` unless told otherwise. */
export const SORTABLE_BY_DEFAULT_TYPES = ['int32', 'int64', 'float', 'bool', 'geopoint'];

export type VectorMode = 'array' | 'vector' | 'embed';

export function isStringType(type: string | undefined): boolean {
  return STRING_TYPES.includes(type ?? '');
}

export function supportsTextOptions(type: string | undefined): boolean {
  return isStringType(type);
}

export function supportsStem(type: string | undefined): boolean {
  return type === 'string' || type === 'string[]';
}

export function supportsSort(type: string | undefined): boolean {
  return SORTABLE_TYPES.includes(type ?? '');
}

export function supportsRangeIndex(type: string | undefined): boolean {
  return NUMERIC_TYPES.includes(type ?? '');
}

export function supportsReference(type: string | undefined): boolean {
  return REFERENCE_TYPES.includes(type ?? '');
}

export function canBeEmbedSource(type: string | undefined): boolean {
  return EMBED_SOURCE_TYPES.includes(type ?? '');
}

export function vectorMode(field: CollectionFieldSchema): VectorMode {
  if (field.embed) return 'embed';
  if (field.num_dim) return 'vector';
  return 'array';
}

export function isVectorField(field: CollectionFieldSchema): boolean {
  return field.type === 'float[]' && vectorMode(field) !== 'array';
}

export function supportsFacet(field: CollectionFieldSchema): boolean {
  return !isVectorField(field);
}

const TEXT_OPTION_KEYS = [
  'locale',
  'infix',
  'truncate_len',
  'token_separators',
  'symbols_to_index',
] as const;
const REFERENCE_KEYS = ['reference', 'async_reference', 'cascade_delete'] as const;
const VECTOR_KEYS = ['num_dim', 'vec_dist', 'hnsw_params', 'embed'] as const;

/**
 * Removes options that do not apply to the field's (new) type, so switching a
 * field from e.g. `float` to `string` does not leave a `range_index` behind that
 * the server would reject. `sort` is reset to the server default for the new type.
 */
export function applyTypeConstraints(field: CollectionFieldSchema): void {
  const record = field as Record<string, unknown>;
  const type = field.type;
  if (!supportsTextOptions(type)) TEXT_OPTION_KEYS.forEach((k) => delete record[k]);
  if (!supportsStem(type)) {
    delete record.stem;
    delete record.stem_dictionary;
  }
  if (!supportsRangeIndex(type)) delete record.range_index;
  if (!supportsReference(type)) REFERENCE_KEYS.forEach((k) => delete record[k]);
  if (type !== 'float[]') VECTOR_KEYS.forEach((k) => delete record[k]);
  if (!supportsFacet(field)) delete record.facet;
  record.sort = SORTABLE_BY_DEFAULT_TYPES.includes(type);
}

/**
 * Switches a `float[]` field between a plain list of floats, a vector with a
 * fixed number of dimensions, and an auto-embedding field.
 */
export function setVectorMode(field: CollectionFieldSchema, mode: VectorMode): void {
  const record = field as Record<string, unknown>;
  if (mode === 'array') {
    VECTOR_KEYS.forEach((k) => delete record[k]);
    return;
  }
  delete record.facet;
  if (mode === 'vector') {
    delete record.embed;
    if (!field.num_dim) record.num_dim = 384;
  } else {
    delete record.num_dim;
    record.embed = record.embed ?? { from: [], model_config: { model_name: '' } };
  }
}

/** A `collection.field` string as accepted by the `reference` field parameter. */
export function isValidReference(value: string | undefined): boolean {
  return !value || /^[^.\s]+\..+$/.test(value);
}
