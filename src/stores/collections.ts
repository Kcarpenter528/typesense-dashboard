import type { CollectionSchema, CollectionUpdateSchema } from 'typesense/lib/Typesense/Collection';
import type { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';
import { acceptHMRUpdate, defineStore } from 'pinia';
import type { Api } from '@/shared/api';
import { buildCreateSchema } from '@/shared/schemaDiff';
import { useNodeStore } from './node';
import { useSynonymsStore } from './synonyms';
import { useCurationsStore } from './curations';

export interface ImportFailure {
  line: number;
  error: string;
  document: string;
}

export interface RecreateCollectionResult {
  ok: boolean;
  documentCount: number;
  failures: ImportFailure[];
  /** Temporary collection left on the server, either on request or because something failed. */
  backupName?: string;
}

export function isValidCollectionsPayload(payload: unknown): payload is CollectionSchema[] {
  if (!Array.isArray(payload)) return false;
  // Collections are objects; require at least a name to avoid treating junk as success.
  return payload.every(
    (c) =>
      c &&
      typeof c === 'object' &&
      !Array.isArray(c) &&
      typeof (c as Record<string, unknown>).name === 'string',
  );
}

async function importJsonl(api: Api, collectionName: string, jsonl: string) {
  const lines = jsonl.split('\n').filter((l) => l.trim());
  if (!lines.length) return [];
  const results = (
    (await api.importDocumentsJsonl(collectionName, lines.join('\n'), 'create')) ?? ''
  )
    .split('\n')
    .filter((l) => l.trim());
  const failures: ImportFailure[] = [];
  results.forEach((raw, index) => {
    const result = JSON.parse(raw) as { success: boolean; error?: string };
    if (!result.success) {
      failures.push({
        line: index + 1,
        error: result.error ?? 'Unknown error',
        document: lines[index] ?? '',
      });
    }
  });
  return failures;
}

interface CollectionsState {
  collections: CollectionSchema[];
  currentCollection: CollectionSchema | null;
}

export const useCollectionsStore = defineStore('collections', {
  state: (): CollectionsState => ({
    collections: [],
    currentCollection: null,
  }),
  actions: {
    async getCollections() {
      const node = useNodeStore();
      try {
        const response = await node.api?.getCollections();
        if (response) this.collections = response;
      } catch (err) {
        console.log(err);
        void node.connectionCheck();
      }
    },
    setCurrentCollection(collection: CollectionSchema | null): void {
      this.currentCollection = collection;
      if (!collection) {
        void this.router.push('/collections');
      }
    },
    loadCurrentCollection(collection: CollectionSchema | null) {
      this.setCurrentCollection(collection);
      if (!collection) {
        return;
      }
      useSynonymsStore().load(collection.name);
      useCurationsStore().load(collection.name);
    },
    loadCurrentCollectionByName(collectionName: string) {
      const collection = this.collections.find((c) => c.name === collectionName);
      if (collection) {
        return this.loadCurrentCollection(collection);
      }
    },
    async dropCollection(name: string) {
      this.setCurrentCollection(null);
      await useNodeStore().api?.dropCollection(name);
      void this.getCollections();
    },
    async createCollection(schema: CollectionSchema) {
      const node = useNodeStore();
      try {
        node.setError(null);
        const collection: CollectionSchema | undefined = await node.api?.createCollection(
          JSON.parse(JSON.stringify(schema)),
        );
        if (!collection) {
          throw new Error('Failed to create collection');
        }
        this.collections = this.collections.concat([collection]);
        this.setCurrentCollection(collection);
        await this.router.push(`/collection/${collection.name}/schema`);
      } catch (error) {
        node.setError((error as Error).message);
      }
    },
    /** Creates a collection without opening it. Shows any failure in the error banner. */
    async createCollectionQuietly(schema: CollectionCreateSchema): Promise<boolean> {
      const node = useNodeStore();
      try {
        node.setError(null);
        const collection = await node.api?.createCollection(schema);
        if (collection) this.collections = this.collections.concat([collection]);
        return !!collection;
      } catch (error) {
        node.setError((error as Error).message);
        return false;
      }
    },
    async updateCollection(payload: {
      collectionName: string;
      schema: CollectionUpdateSchema;
    }): Promise<boolean> {
      const node = useNodeStore();
      try {
        node.setError(null);
        await node.api?.updateCollection(payload.collectionName, payload.schema);
        await this.refreshCollection(payload.collectionName);
        return true;
      } catch (error) {
        node.setError((error as Error).message);
        return false;
      }
    },
    async refreshCollection(collectionName: string) {
      const collection = await useNodeStore().api?.getCollection(collectionName);
      if (!collection) return;
      const exists = this.collections.some((c) => c.name === collectionName);
      this.collections = exists
        ? this.collections.map((c) => (c.name === collectionName ? collection : c))
        : this.collections.concat([collection]);
      this.setCurrentCollection(collection);
    },
    /**
     * Recreates a collection under the same name with a new schema, keeping its documents.
     * Needed for settings Typesense only accepts at creation (e.g. `enable_nested_fields`).
     *
     * The documents are first imported into a temporary collection with the new schema,
     * which validates every document while the original is still untouched. Only then is
     * the original dropped and recreated, and the temporary collection is kept until the
     * final import succeeds, so the data always exists on the server.
     */
    async recreateCollection(payload: {
      collectionName: string;
      schema: CollectionCreateSchema;
      keepBackup: boolean;
      onProgress?: (message: string) => void;
    }): Promise<RecreateCollectionResult> {
      const node = useNodeStore();
      const api = node.api;
      if (!api) throw new Error('Not connected');
      const { collectionName, keepBackup } = payload;
      const progress = payload.onProgress ?? (() => undefined);
      const tempName = `${collectionName}__recreate_${Date.now()}`;
      const legacyCurations = !node.data.features.synonymSets;

      progress('Exporting documents');
      const jsonl = (await api.exportDocuments(collectionName)) ?? '';
      const documentCount = jsonl.split('\n').filter((l) => l.trim()).length;

      // Before v30, synonyms and curations belong to the collection and are lost on drop.
      let legacySynonyms: any[] = [];
      let legacyOverrides: any[] = [];
      if (legacyCurations) {
        legacySynonyms = ((await api.getSynonyms(collectionName)) as any)?.synonyms ?? [];
        legacyOverrides = ((await api.getOverrides(collectionName)) as any)?.overrides ?? [];
      }

      progress(`Validating ${documentCount} documents against the new schema`);
      await api.createCollection(buildCreateSchema(payload.schema, tempName));
      const tempFailures = await importJsonl(api, tempName, jsonl);
      if (tempFailures.length) {
        await api.dropCollection(tempName);
        return { ok: false, documentCount, failures: tempFailures };
      }

      progress(`Replacing ${collectionName}`);
      await api.dropCollection(collectionName);
      try {
        await api.createCollection(buildCreateSchema(payload.schema, collectionName));
        progress(`Importing ${documentCount} documents`);
        const failures = await importJsonl(api, collectionName, jsonl);
        if (failures.length) {
          await this.getCollections();
          return { ok: false, documentCount, failures, backupName: tempName };
        }
        for (const { id, ...synonym } of legacySynonyms) {
          await api.upsertSynonym(collectionName, id, synonym);
        }
        for (const { id, ...override } of legacyOverrides) {
          await api.upsertOverride(collectionName, id, override);
        }
      } catch (error) {
        await this.getCollections();
        throw new Error(
          `${(error as Error).message}. Your documents are safe in the collection \`${tempName}\`.`,
          { cause: error },
        );
      }

      if (!keepBackup) {
        progress('Removing temporary copy');
        await api.dropCollection(tempName);
      }
      await this.getCollections();
      await this.refreshCollection(collectionName);
      return {
        ok: true,
        documentCount,
        failures: [],
        ...(keepBackup ? { backupName: tempName } : {}),
      };
    },
    async cloneCollectionSchema(payload: { collectionName: string; destinationName: string }) {
      const node = useNodeStore();
      try {
        node.setError(null);
        await node.api?.post(`/collections?src_name=${payload.collectionName}`, {
          name: payload.destinationName,
        });
        const collection = await node.api?.getCollection(payload.destinationName);
        if (!collection) {
          throw new Error('Failed to clone collection');
        }
        this.collections = this.collections.concat([collection]);
        this.setCurrentCollection(collection);
        await this.router.push(`/collection/${payload.destinationName}/schema`);
      } catch (error) {
        node.setError((error as Error).message);
      }
    },
  },
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useCollectionsStore, import.meta.hot));
}
