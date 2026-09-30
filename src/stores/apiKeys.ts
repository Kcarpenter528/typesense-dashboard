import type { KeySchema } from 'typesense/lib/Typesense/Key';
import { acceptHMRUpdate, defineStore } from 'pinia';
import { useNodeStore } from './node';

export const useApiKeysStore = defineStore('apiKeys', {
  state: () => ({
    apiKeys: [] as KeySchema[],
  }),
  actions: {
    async load() {
      const response = await useNodeStore().api?.getApiKeys();
      if (response) this.apiKeys = response.keys;
    },
    /** Creates a key and resolves with it; the full key value is only returned this once. */
    async create(apiKey: KeySchema): Promise<KeySchema> {
      const node = useNodeStore();
      try {
        node.setError(null);
        const key = (await node.api?.createApiKey(apiKey)) as KeySchema;
        void this.load();
        return key;
      } catch (error) {
        node.setError((error as Error).message);
        throw error;
      }
    },
    async remove(id: string) {
      await useNodeStore().api?.deleteApiKey(id);
      void this.load();
    },
  },
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useApiKeysStore, import.meta.hot));
}
