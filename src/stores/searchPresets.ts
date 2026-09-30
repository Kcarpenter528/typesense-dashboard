import type { PresetSchema } from 'typesense/lib/Typesense/Preset';
import { acceptHMRUpdate, defineStore } from 'pinia';
import { useNodeStore } from './node';

export const useSearchPresetsStore = defineStore('searchPresets', {
  state: () => ({
    presets: [] as PresetSchema<any>[],
  }),
  actions: {
    async load() {
      const response = await useNodeStore().api?.getSearchPresets();
      if (response) this.presets = response.presets;
    },
    async upsert(preset: any) {
      const node = useNodeStore();
      try {
        node.setError(null);
        await node.api?.upsertSearchPreset(preset.name, preset);
        void this.load();
      } catch (error) {
        node.setError((error as Error).message);
      }
    },
    async remove(name: string) {
      await useNodeStore().api?.deleteSearchPreset(name);
      void this.load();
    },
  },
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useSearchPresetsStore, import.meta.hot));
}
