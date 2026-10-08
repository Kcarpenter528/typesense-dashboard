import { describe, expect, it } from 'vitest';
import { referenceIncludeFields } from './references';

describe('referenceIncludeFields', () => {
  it('returns an empty string without references', () => {
    expect(referenceIncludeFields(undefined)).toBe('');
    expect(referenceIncludeFields([{ name: 'title' }])).toBe('');
  });

  it('joins each referenced collection once', () => {
    expect(
      referenceIncludeFields([
        { name: 'author_id', reference: 'authors.id' },
        { name: 'editor_id', reference: 'authors.id' },
        { name: 'publisher_id', reference: 'publishers.id' },
      ]),
    ).toBe('$authors(*),$publishers(*)');
  });
});
