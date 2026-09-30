import type { StopwordSchema } from 'typesense/lib/Typesense/Stopword';
import { acceptHMRUpdate, defineStore } from 'pinia';
import { useNodeStore } from './node';

export const useStopwordsStore = defineStore('stopwords', {
  state: () => ({
    stopwords: [] as StopwordSchema[],
  }),
  actions: {
    async load() {
      const response = await useNodeStore().api?.getStopwords();
      if (response) this.stopwords = response.stopwords;
    },
    async upsert(stopwordsSet: any) {
      const node = useNodeStore();
      try {
        node.setError(null);
        await node.api?.upsertStopwords(stopwordsSet.id, stopwordsSet);
        void this.load();
      } catch (error) {
        node.setError((error as Error).message);
      }
    },
    async remove(id: string) {
      await useNodeStore().api?.deleteStopwords(id);
      void this.load();
    },
  },
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useStopwordsStore, import.meta.hot));
}
