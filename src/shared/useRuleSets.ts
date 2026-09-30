import { computed, ref } from 'vue';
import type { CollectionSchema } from 'typesense/lib/Typesense/Collection';
import { useNodeStore } from '@/stores/node';
import { useCollectionsStore } from '@/stores/collections';
import { useCurationsStore } from '@/stores/curations';
import { useSynonymsStore } from '@/stores/synonyms';

/**
 * Synonym sets and curation sets (Typesense v30+) work the same way: a named set of
 * items that collections opt into through `synonym_sets` / `curation_sets`. This keeps
 * every change explicit about which set and which collections it touches.
 *
 * Deleting a set that a collection still lists breaks search on that collection
 * ("Synonym index not found"), so sets are always unlinked everywhere before deletion,
 * and removing a set's last item leaves an empty set rather than deleting it.
 */

export type RuleSetKind = 'synonym' | 'curation';

export interface RuleSetItem {
  id: string;
  [key: string]: unknown;
}

export interface RuleSet {
  name: string;
  items: RuleSetItem[];
}

const COLLECTION_KEY = {
  synonym: 'synonym_sets',
  curation: 'curation_sets',
} as const;

export function useRuleSets(kind: RuleSetKind) {
  const store = useNodeStore();
  const collectionsStore = useCollectionsStore();
  const curationsStore = useCurationsStore();
  const synonymsStore = useSynonymsStore();
  const sets = ref<RuleSet[]>([]);
  const loading = ref(false);
  const key = COLLECTION_KEY[kind];

  const noun = kind === 'synonym' ? 'synonym set' : 'curation set';

  function linkedTo(setName: string): string[] {
    return collectionsStore.collections
      .filter((c) =>
        ((c as CollectionSchema & Record<string, string[] | undefined>)[key] ?? []).includes(
          setName,
        ),
      )
      .map((c) => c.name);
  }

  const setsWithUsage = computed(() =>
    sets.value.map((set) => ({ ...set, collections: linkedTo(set.name) })),
  );

  async function run<T>(task: () => Promise<T> | undefined): Promise<T | undefined> {
    try {
      store.setError(null);
      return await task();
    } catch (error) {
      store.setError((error as Error).message);
      return undefined;
    }
  }

  async function load() {
    loading.value = true;
    const result = await run<unknown>(() =>
      kind === 'synonym' ? synonymsStore.fetchSets() : curationsStore.fetchSets(),
    );
    sets.value = ((result ?? []) as unknown as RuleSet[])
      .map((s) => ({ name: s.name, items: s.items ?? [] }))
      .sort((a, b) => a.name.localeCompare(b.name));
    loading.value = false;
  }

  async function createSet(name: string) {
    const ok = await run(async () => {
      if (kind === 'synonym') await store.api?.upsertSynonymSet(name, { items: [] });
      else await store.api?.upsertCurationSet(name, { items: [] });
      return true;
    });
    await load();
    return !!ok;
  }

  async function saveItem(setName: string, item: RuleSetItem) {
    const ok = await run(async () => {
      if (kind === 'synonym') {
        const { id, ...rest } = item;
        await store.api?.upsertSynonymSetItem(setName, id, rest as never);
      } else {
        await store.api?.upsertCurationSetItem(setName, item as never);
      }
      return true;
    });
    await load();
    return !!ok;
  }

  async function deleteItem(setName: string, id: string) {
    const ok = await run(async () => {
      if (kind === 'synonym') await store.api?.deleteSynonymSetItem(setName, id);
      else await store.api?.deleteCurationSetItem(setName, id);
      return true;
    });
    await load();
    return !!ok;
  }

  /** Makes exactly these collections use the set, adding or removing it as needed. */
  async function setCollections(setName: string, wanted: string[]) {
    const ok = await run(async () => {
      for (const collection of collectionsStore.collections) {
        const current =
          (collection as CollectionSchema & Record<string, string[] | undefined>)[key] ?? [];
        const has = current.includes(setName);
        const want = wanted.includes(collection.name);
        if (has === want) continue;
        const next = want ? [...current, setName] : current.filter((s) => s !== setName);
        await store.api?.updateCollection(collection.name, { [key]: next });
      }
      return true;
    });
    await collectionsStore.getCollections();
    return !!ok;
  }

  async function deleteSet(setName: string) {
    const unlinked = await setCollections(setName, []);
    if (!unlinked) return false;
    const ok = await run(async () => {
      if (kind === 'synonym') await store.api?.deleteSynonymSet(setName);
      else await store.api?.deleteCurationSet(setName);
      return true;
    });
    await load();
    return !!ok;
  }

  return {
    sets: setsWithUsage,
    loading,
    noun,
    load,
    linkedTo,
    createSet,
    saveItem,
    deleteItem,
    setCollections,
    deleteSet,
  };
}
