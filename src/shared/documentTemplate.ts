import type { CollectionFieldSchema } from 'typesense/lib/Typesense/Collection';

/**
 * Builds an example document for a collection's schema, to start the "Add documents"
 * editor from something that actually imports.
 *
 * - Nested sub-fields (customer.name) are placed inside their parent object instead
 *   of appearing as flat keys, and object[] fields get one example element.
 * - Wildcard or regex field names (.*, .*_price) and auto-embedding fields are left
 *   out: they don't name a property, or the server fills them in.
 */
export function buildDocumentTemplate(fields: CollectionFieldSchema[]): Record<string, unknown> {
  const doc: Record<string, unknown> = {};
  const usable = fields.filter((f) => isConcreteName(f.name) && !f.embed);

  for (const field of usable.filter((f) => !f.name.includes('.'))) {
    doc[field.name] = exampleValue(field);
  }

  // Sub-fields, deepest last, so their parents exist first.
  const nested = usable
    .filter((f) => f.name.includes('.'))
    .sort((a, b) => a.name.split('.').length - b.name.split('.').length);
  for (const field of nested) {
    placeNested(doc, field, fields);
  }
  return doc;
}

function isConcreteName(name: string) {
  return !/[*^$\\[\]()+?{}|]/.test(name);
}

function exampleValue(field: CollectionFieldSchema): unknown {
  const type = field.type;
  if (type === 'object') return {};
  if (type === 'object[]') return [{}];
  if (type === 'geopoint') return [0, 0];
  if (type === 'geopoint[]') return [[0, 0]];
  if (type === 'geopolygon') return [0, 0, 0, 1, 1, 1];
  if (type.endsWith('[]')) return [];
  if (type.startsWith('int') || type === 'float') return 0;
  if (type === 'bool') return false;
  return '';
}

function placeNested(
  doc: Record<string, unknown>,
  field: CollectionFieldSchema,
  fields: CollectionFieldSchema[],
) {
  const path = field.name.split('.');
  let target: Record<string, unknown> = doc;
  let insideArray = false;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i]!;
    const parentName = path.slice(0, i + 1).join('.');
    const parentType = fields.find((f) => f.name === parentName)?.type;
    if (Array.isArray(target[key]) || parentType === 'object[]') {
      if (!Array.isArray(target[key]) || !(target[key] as unknown[]).length) target[key] = [{}];
      target = (target[key] as Record<string, unknown>[])[0]!;
      insideArray = true;
    } else {
      if (!target[key] || typeof target[key] !== 'object') target[key] = {};
      target = target[key] as Record<string, unknown>;
    }
  }
  // Typesense reports tasks.title as string[] when tasks is object[]; inside one element
  // of the array it is a single string.
  const type = insideArray && field.type.endsWith('[]') ? field.type.slice(0, -2) : field.type;
  target[path[path.length - 1]!] = exampleValue({ ...field, type } as CollectionFieldSchema);
}
