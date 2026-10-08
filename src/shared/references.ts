interface FieldWithReference {
  name: string;
  reference?: string;
}

/**
 * Typesense only returns joined documents when `include_fields` names them, e.g. `$authors(*)`.
 * Returns that clause for every collection the given fields reference, or '' when there are none.
 */
export function referenceIncludeFields(fields: FieldWithReference[] | undefined): string {
  const collections = new Set<string>();
  for (const field of fields ?? []) {
    const collection = field.reference?.split('.')[0];
    if (collection) collections.add(collection);
  }
  return [...collections].map((name) => `$${name}(*)`).join(',');
}
