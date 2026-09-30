import type { SearchParams } from 'typesense/lib/Typesense/Documents';
import { acceptHMRUpdate, defineStore } from 'pinia';
import type { Api } from '@/shared/api';
import { saveText } from '@/shared/download';
import { useNodeStore } from './node';
import { useCollectionsStore } from './collections';

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
