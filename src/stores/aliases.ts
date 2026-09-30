import type { CollectionAliasSchema } from 'typesense/lib/Typesense/Aliases';
import { acceptHMRUpdate, defineStore } from 'pinia';
import { useNodeStore } from './node';

export const useAliasesStore = defineStore('aliases', {
  state: () => ({
    aliases: [] as CollectionAliasSchema[],
  }),
  actions: {
    async load() {
      const response = await useNodeStore().api?.getAliases();
      if (response) this.aliases = response.aliases;
    },
    async upsert(alias: CollectionAliasSchema) {
      const node = useNodeStore();
      try {
        node.setError(null);
        await node.api?.upsertAlias(alias);
        void this.load();
      } catch (error) {
        node.setError((error as Error).message);
      }
    },
    async remove(name: string) {
      await useNodeStore().api?.deleteAlias(name);
      void this.load();
    },
  },
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAliasesStore, import.meta.hot));
}
