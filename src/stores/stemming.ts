import type { StemmingDictionarySchema } from 'typesense/lib/Typesense/StemmingDictionary';
import { acceptHMRUpdate, defineStore } from 'pinia';
import { useNodeStore } from './node';

export const useStemmingStore = defineStore('stemming', {
  state: () => ({
    /** Dictionary IDs. */
    dictionaries: [] as string[],
  }),
  actions: {
    async load() {
      const response = await useNodeStore().api?.getStemmingDictionaries();
      if (response) this.dictionaries = response.dictionaries;
    },
    async get(id: string) {
      return await useNodeStore().api?.getStemmingDictionary(id);
    },
    /** Adds word/root pairs to a dictionary. The server never removes pairs on import. */
    async upsert(dictionary: StemmingDictionarySchema) {
      const node = useNodeStore();
      try {
        node.setError(null);
        await node.api?.upsertStemmingDictionaries(dictionary.id, dictionary.words);
        void this.load();
      } catch (error) {
        node.setError((error as Error).message);
      }
    },
    async remove(id: string) {
      await useNodeStore().api?.delete(`/stemming/dictionaries/${id}`);
      void this.load();
    },
  },
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useStemmingStore, import.meta.hot));
}
