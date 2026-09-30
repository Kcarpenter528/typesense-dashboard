import type { OverrideSchema } from 'typesense/lib/Typesense/Override';
import type { OverrideCreateSchema } from 'typesense/lib/Typesense/Overrides';
import type { CurationSetsListEntrySchema } from 'typesense/lib/Typesense/CurationSets';
import { acceptHMRUpdate, defineStore } from 'pinia';
import { useNodeStore } from './node';
import { useCollectionsStore } from './collections';

/**
 * Curations (overrides) stored on a collection (Typesense before v30). From v30 on,
 * curations live in curation sets, which are managed through `useRuleSets('curation')`.
 */
export const useCurationsStore = defineStore('curations', {
  state: () => ({
    overrides: [] as OverrideSchema[],
  }),
  actions: {
    /** Lists all curation sets; throws when the server has no curation sets API. */
    async fetchSets(): Promise<CurationSetsListEntrySchema[]> {
      const response = await useNodeStore().api?.getCurationSets();
      return Array.isArray(response) ? response : [];
    },
    load(collectionName: string) {
      if (useNodeStore().data.features.curationSets || !collectionName) return;
      void useNodeStore()
        .api?.getOverrides(collectionName)
        ?.then((response: { overrides: OverrideSchema[] }) => {
          this.overrides = response.overrides;
        })
        // v30 removed per-collection overrides; this can run before feature detection finishes.
        .catch(() => (this.overrides = []));
    },
    async create(payload: { id: string; override: OverrideCreateSchema }) {
      const node = useNodeStore();
      try {
        node.setError(null);
        const collection = useCollectionsStore().currentCollection;
        if (!collection) throw new Error('No collection selected');
        const override = JSON.parse(JSON.stringify(payload.override)) as OverrideCreateSchema;
        if (!node.supportsCurationRuleTags && override.rule) {
          delete override.rule.tags;
        }
        await node.api?.upsertOverride(collection.name, payload.id, override);
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
        await node.api?.deleteOverride(collection.name, id);
        this.load(collection.name);
      } catch (error) {
        node.setError((error as Error).message);
      }
    },
  },
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useCurationsStore, import.meta.hot));
}
