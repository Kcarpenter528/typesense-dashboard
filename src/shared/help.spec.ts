import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  FALLBACK_DOCS_VERSION,
  FIELD_HELP,
  PAGE_HELP,
  docUrl,
  docsVersion,
  resolveTopic,
  serverFlagTopic,
} from './help';
import { NAV_SECTIONS } from './navigation';

describe('docsVersion', () => {
  it('uses release versions and falls back for anything else', () => {
    expect(docsVersion('30.2')).toBe('30.2');
    expect(docsVersion('0.25.2')).toBe('0.25.2');
    expect(docsVersion('nightly')).toBe(FALLBACK_DOCS_VERSION);
    expect(docsVersion(undefined)).toBe(FALLBACK_DOCS_VERSION);
    expect(docsVersion('30.2.rc1')).toBe(FALLBACK_DOCS_VERSION);
  });
});

describe('docUrl', () => {
  it('versions API links and not Guide links', () => {
    expect(docUrl({ kind: 'api', page: 'collections', anchor: 'field-parameters' }, '29.0')).toBe(
      'https://typesense.org/docs/29.0/api/collections.html#field-parameters',
    );
    expect(docUrl({ kind: 'guide', page: 'tips-for-filtering' }, '29.0')).toBe(
      'https://typesense.org/docs/guide/tips-for-filtering.html',
    );
  });
});

describe('help topics', () => {
  const topics = { ...PAGE_HELP, ...FIELD_HELP };

  it('each have a title, an explanation and at least one docs link', () => {
    for (const [key, topic] of Object.entries(topics)) {
      expect(topic.title, key).toBeTruthy();
      expect(topic.body.length, key).toBeGreaterThan(20);
      expect(topic.links.length, key).toBeGreaterThan(0);
    }
  });

  it('link every help-enabled nav item to a page topic', () => {
    for (const item of NAV_SECTIONS.flatMap((s) => s.items)) {
      if (item.help) expect(PAGE_HELP[item.help], item.label).toBeDefined();
    }
  });

  it('builds help for a server flag from its description', () => {
    const topic = serverFlagTopic(
      { key: 'cors-domains', label: 'Allowed origins', description: 'Comma-separated `origins`.' },
      true,
    );
    expect(topic.body).toBe('Comma-separated origins.');
    expect(docUrl(topic.links[0]!)).toMatch(/server-configuration\.html#cors$/);
    expect(topic.links).toHaveLength(2);
  });
});

/** Every `topic="…"` used in a component must exist, since templates aren't type-checked. */
describe('help-tip usage', () => {
  function vueFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return vueFiles(path);
      return path.endsWith('.vue') ? [path] : [];
    });
  }

  it('only names topics that exist', () => {
    const root = join(__dirname, '..');
    const used = vueFiles(root).flatMap((file) =>
      [...readFileSync(file, 'utf8').matchAll(/<help-tip[^>]*?\stopic="([^"]+)"/g)].map(
        (m) => [file, m[1]!] as const,
      ),
    );
    expect(used.length).toBeGreaterThan(40);
    for (const [file, topic] of used) {
      expect(resolveTopic(topic), `${topic} in ${file}`).toBeDefined();
    }
  });
});
