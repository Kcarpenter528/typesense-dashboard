import type { SynonymSchema } from 'typesense/lib/Typesense/Synonym';
import type { SynonymCreateSchema } from 'typesense/lib/Typesense/Synonyms';
import type { SynonymSetSchema } from 'typesense/lib/Typesense/SynonymSets';
import { acceptHMRUpdate, defineStore } from 'pinia';
import { useNodeStore } from './node';
import { useCollectionsStore } from './collections';

/**
 * Synonyms stored on a collection (Typesense before v30). From v30 on, synonyms live in
 * synonym sets, which are managed through `useRuleSets('synonym')`.
 */
export const useSynonymsStore = defineStore('synonyms', {
  state: () => ({
    synonyms: [] as SynonymSchema[],
  }),
  actions: {
    /** Lists all synonym sets; throws when the server has no synonym sets API. */
    async fetchSets(): Promise<SynonymSetSchema[]> {
      const response = await useNodeStore().api?.getSynonymSets();
      return Array.isArray(response) ? response : [];
    },
    load(collectionName: string) {
      if (useNodeStore().data.features.synonymSets || !collectionName) return;
      void useNodeStore()
        .api?.getSynonyms(collectionName)
        ?.then((response: { synonyms: SynonymSchema[] }) => {
          this.synonyms = response.synonyms;
        })
        // v30 removed per-collection synonyms; this can run before feature detection finishes.
        .catch(() => (this.synonyms = []));
    },
    async create(payload: { id: string; synonym: SynonymCreateSchema }) {
      const node = useNodeStore();
      try {
        node.setError(null);
        const collection = useCollectionsStore().currentCollection;
        if (!collection) throw new Error('No collection selected');
        await node.api?.upsertSynonym(collection.name, payload.id, {
          id: payload.id,
          ...payload.synonym,
        });
        this.load(collection.name);
      } catch (error) {
        node.setError((error as Error).message);
      }
    },
    async remove(id: string) {
      const node = useNodeStore();
      try {
        node.setError(null);
        const collection = useCollectionsStore().currentCollection;
        if (!collection) throw new Error('No collection selected');
        await node.api?.deleteSynonym(collection.name, id);
        this.load(collection.name);
      } catch (error) {
        node.setError((error as Error).message);
      }
    },
  },
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useSynonymsStore, import.meta.hot));
}
