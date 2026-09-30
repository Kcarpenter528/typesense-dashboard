import { computed, reactive } from 'vue';
import { useNodeStore } from '@/stores/node';
import { nodeId, readNodePref, writeNodePref } from './nodePrefs';

export interface AppliedSetting {
  value: number | boolean;
  /** Epoch milliseconds. */
  at: number;
}

type History = Record<string, AppliedSetting>;

const PREF_NAME = 'runtime-config';
const cache = reactive<Record<string, History>>({});

/**
 * The runtime settings last applied from this browser to the connected node.
 * Typesense has no endpoint to read them back, so this is the best available record.
 */
export function useRuntimeHistory() {
  const store = useNodeStore();
  const node = computed(() => store.loginData?.node);

  const applied = computed<History>(() => {
    const current = node.value;
    if (!current) return {};
    const id = nodeId(current);
    if (!cache[id]) cache[id] = readNodePref<History>(PREF_NAME, current, {});
    return cache[id];
  });

  function record(key: string, value: number | boolean, isDefault: boolean) {
    const current = node.value;
    if (!current) return;
    const history = { ...applied.value };
    if (isDefault) delete history[key];
    else history[key] = { value, at: Date.now() };
    cache[nodeId(current)] = history;
    writeNodePref(PREF_NAME, current, history);
  }

  return { applied, record };
}
