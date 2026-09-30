import { LocalStorage } from 'quasar';
import type { NodeConfiguration } from 'typesense/lib/Typesense/Configuration';

/**
 * Per-server preferences kept in this browser only (e.g. the last runtime settings
 * applied from the dashboard, since Typesense cannot report them). Storage can be
 * unavailable, so every read falls back and every write is best-effort.
 */

export function nodeId(
  node: Pick<NodeConfiguration, 'protocol' | 'host' | 'port'> & { path?: string },
) {
  return `${node.protocol}://${node.host}:${node.port}${node.path ?? ''}`;
}

function storageKey(name: string, node: Parameters<typeof nodeId>[0]) {
  return `typesense-${name}:${nodeId(node)}`;
}

export function readNodePref<T>(name: string, node: Parameters<typeof nodeId>[0], fallback: T): T {
  try {
    const value = LocalStorage.getItem(storageKey(name, node)) as T | null;
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeNodePref(name: string, node: Parameters<typeof nodeId>[0], value: unknown) {
  try {
    LocalStorage.set(storageKey(name, node), value);
  } catch {
    // Storage is unavailable (private mode, blocked site data); the preference just isn't kept.
  }
}
