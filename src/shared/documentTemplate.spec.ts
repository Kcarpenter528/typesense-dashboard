import { describe, expect, it } from 'vitest';
import type { CollectionFieldSchema } from 'typesense/lib/Typesense/Collection';
import { buildDocumentTemplate } from './documentTemplate';

const f = (name: string, type: string, extra: Record<string, unknown> = {}) =>
  ({ name, type, ...extra }) as CollectionFieldSchema;

describe('buildDocumentTemplate', () => {
  it('gives each scalar and array type a sensible example', () => {
    expect(
      buildDocumentTemplate([
        f('title', 'string'),
        f('tags', 'string[]'),
        f('count', 'int32'),
        f('price', 'float'),
        f('active', 'bool'),
        f('location', 'geopoint'),
      ]),
    ).toEqual({ title: '', tags: [], count: 0, price: 0, active: false, location: [0, 0] });
  });

  it('nests auto-detected sub-fields inside their object (the reported bug)', () => {
    // As returned by the server for the milestone collection after indexing documents.
    expect(
      buildDocumentTemplate([
        f('Id', 'string'),
        f('kineticCustomer', 'object'),
        f('milestoneTasks', 'object[]'),
        f('kineticCustomer.name', 'string'),
        f('kineticCustomer.accountNo', 'int64'),
        f('milestoneTasks.title', 'string[]'),
        f('milestoneTasks.done', 'bool[]'),
      ]),
    ).toEqual({
      Id: '',
      kineticCustomer: { name: '', accountNo: 0 },
      milestoneTasks: [{ title: '', done: false }],
    });
  });

  it('leaves out wildcard fields and auto-embedding fields', () => {
    expect(
      buildDocumentTemplate([
        f('title', 'string'),
        f('.*', 'auto'),
        f('.*_price', 'float'),
        f('embedding', 'float[]', {
          embed: { from: ['title'], model_config: { model_name: 'ts/e5-small' } },
        }),
      ]),
    ).toEqual({ title: '' });
  });

  it('creates missing parents for declared sub-fields', () => {
    expect(buildDocumentTemplate([f('address.city', 'string')])).toEqual({ address: { city: '' } });
  });
});
