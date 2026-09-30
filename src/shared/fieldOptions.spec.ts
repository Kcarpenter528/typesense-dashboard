import { describe, expect, it } from 'vitest';
import type { CollectionFieldSchema } from 'typesense/lib/Typesense/Collection';
import {
  applyTypeConstraints,
  isValidReference,
  setVectorMode,
  supportsFacet,
  supportsRangeIndex,
  supportsSort,
  vectorMode,
} from './fieldOptions';

describe('type capabilities', () => {
  // Mirrors what Typesense 30.2 accepts or rejects.
  it('allows sort only on scalar sortable types and geopoint[]', () => {
    expect(['int32', 'float', 'bool', 'string', 'geopoint[]'].every(supportsSort)).toBe(true);
    expect(['int32[]', 'bool[]', 'string[]', 'object'].some(supportsSort)).toBe(false);
  });

  it('allows range_index only on numeric types', () => {
    expect(supportsRangeIndex('int32[]')).toBe(true);
    expect(supportsRangeIndex('string')).toBe(false);
  });

  it('does not allow faceting on vectors', () => {
    expect(supportsFacet({ name: 'v', type: 'float[]', num_dim: 3 })).toBe(false);
    expect(supportsFacet({ name: 'v', type: 'float[]' })).toBe(true);
  });

  it('validates references', () => {
    expect(isValidReference('authors.id')).toBe(true);
    expect(isValidReference('')).toBe(true);
    expect(isValidReference('authors')).toBe(false);
  });
});

describe('applyTypeConstraints', () => {
  it('removes options that do not apply to the new type', () => {
    const field: CollectionFieldSchema = {
      name: 'x',
      type: 'string',
      locale: 'fr',
      stem: true,
      stem_dictionary: 'plurals',
      infix: true,
      token_separators: ['-'],
      reference: 'authors.id',
      sort: false,
    };
    field.type = 'float';
    applyTypeConstraints(field);
    expect(field).toEqual({ name: 'x', type: 'float', sort: true });
  });

  it('keeps options that still apply', () => {
    const field: CollectionFieldSchema = {
      name: 'x',
      type: 'int32',
      range_index: true,
      reference: 'a.b',
      facet: true,
    };
    field.type = 'int64';
    applyTypeConstraints(field);
    expect(field).toMatchObject({ range_index: true, reference: 'a.b', facet: true, sort: true });
  });
});

describe('setVectorMode', () => {
  it('switches between array, vector and embedding', () => {
    const field: CollectionFieldSchema = { name: 'v', type: 'float[]', facet: true };
    setVectorMode(field, 'vector');
    expect(vectorMode(field)).toBe('vector');
    expect(field.num_dim).toBe(384);
    expect(field.facet).toBeUndefined();

    setVectorMode(field, 'embed');
    expect(vectorMode(field)).toBe('embed');
    expect(field.num_dim).toBeUndefined();

    setVectorMode(field, 'array');
    expect(field).toEqual({ name: 'v', type: 'float[]' });
  });
});
