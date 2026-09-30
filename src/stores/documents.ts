import type { SearchParams } from 'typesense/lib/Typesense/Documents';
import { acceptHMRUpdate, defineStore } from 'pinia';
import type { Api } from '@/shared/api';
import { saveText } from '@/shared/download';
import { useNodeStore } from './node';
import { useCollectionsStore } from './collections';

export interface ConversationResult {
  answer: string;
  conversationId: string;
  found: number;
  /** The documents the answer was based on. */
  sources: Record<string, unknown>[];
}

function currentCollectionName(): string {
  const name = useCollectionsStore().currentCollection?.name;
  if (!name) throw new Error('No collection selected');
  return name;
}

export const useDocumentsStore = defineStore('documents', {
  state: () => ({
    /** Documents handed from search results to the document editor. */
    documentsToEdit: [] as any[] | null,
  }),
  actions: {
    deleteDocumentById(id: string) {
      return useNodeStore().api?.deleteDocumentById(currentCollectionName(), id);
    },
    search(payload: SearchParams<any>) {
      return (useNodeStore().api as Api)?.search(
        useCollectionsStore().currentCollection?.name || '',
        JSON.parse(JSON.stringify(payload)), // remove proxy which is not serializable
      );
    },
    importDocuments(payload: { action: string; documents: unknown[] }): Promise<any> {
      return useNodeStore().api?.importDocuments(
        currentCollectionName(),
        payload.documents,
        payload.action,
      );
    },
    async exportDocuments(collectionName: string): Promise<void> {
      const documents = await useNodeStore().api?.exportDocuments(collectionName);
      if (documents !== undefined) saveText(documents, `${collectionName}.jsonl`);
    },
    /**
     * Asks a conversation model a question about a collection. Pass the previous
     * `conversation_id` for a follow-up question. Conversational search only works
     * through `/multi_search`, with `q` as a query parameter.
     */
    async converse(payload: {
      collectionName: string;
      question: string;
      modelId: string;
      queryBy: string;
      excludeFields: string;
      conversationId?: string;
    }): Promise<ConversationResult> {
      const response = (await useNodeStore().api?.multiSearch(
        payload.collectionName,
        { query_by: payload.queryBy, exclude_fields: payload.excludeFields, per_page: 5 },
        {
          q: payload.question,
          conversation: true,
          conversation_model_id: payload.modelId,
          ...(payload.conversationId ? { conversation_id: payload.conversationId } : {}),
        },
      )) as unknown as {
        conversation?: { answer: string; conversation_id: string };
        results?: {
          found?: number;
          hits?: { document: Record<string, unknown> }[];
          error?: string;
        }[];
      };
      const result = response?.results?.[0];
      if (result?.error) throw new Error(result.error);
      return {
        answer: response?.conversation?.answer ?? '',
        conversationId: response?.conversation?.conversation_id ?? '',
        found: result?.found ?? 0,
        sources: (result?.hits ?? []).map((h) => h.document),
      };
    },
    /** How many documents a filter matches, without fetching any of them. */
    async countMatching(collectionName: string, filterBy: string): Promise<number> {
      const response = await useNodeStore().api?.search(collectionName, {
        q: '*',
        filter_by: filterBy,
        per_page: 0,
      });
      return response?.found ?? 0;
    },
    /** Deletes the documents matching a filter and resolves with how many were deleted. */
    async deleteByFilter(collectionName: string, filterBy: string): Promise<number> {
      const response = await useNodeStore().api?.deleteDocumentsByFilter(collectionName, filterBy);
      await useCollectionsStore().getCollections();
      return response?.num_deleted ?? 0;
    },
    /** Deletes every document, keeping the collection, its schema and its settings. */
    async truncate(collectionName: string): Promise<number> {
      const response = await useNodeStore().api?.truncateCollection(collectionName);
      await useCollectionsStore().getCollections();
      return response?.num_deleted ?? 0;
    },
    setDocumentsToEdit(documents: any[]): void {
      this.documentsToEdit = documents;
    },
    editDocuments(documents: any[]) {
      this.setDocumentsToEdit(documents);
      const name = useCollectionsStore().currentCollection?.name || '';
      void this.router.push(`/collection/${name}/document`);
    },
  },
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useDocumentsStore, import.meta.hot));
}
