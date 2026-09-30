import { useQuasar } from 'quasar';
import { useRouter } from 'vue-router';
import { useNodeStore } from '@/stores/node';

/** Collection-level actions shared by the collections list and a collection's header. */
export function useCollectionActions() {
  const $q = useQuasar();
  const store = useNodeStore();
  const router = useRouter();

  async function exportCollection(collectionName: string) {
    $q.loading.show({ message: `Exporting ${collectionName}…` });
    try {
      await store.exportDocuments(collectionName);
    } catch {
      $q.notify({
        type: 'negative',
        position: 'top',
        message: "The export didn't finish. Large collections may need the desktop app or the API.",
      });
    } finally {
      $q.loading.hide();
    }
  }

  function deleteCollection(name: string) {
    const count = store.data.collections.find((c) => c.name === name)?.num_documents ?? 0;
    $q.dialog({
      title: `Delete ${name}?`,
      message: `This permanently deletes the collection and its ${count.toLocaleString()} documents. Type the collection name to confirm.`,
      prompt: { model: '', type: 'text', isValid: (value: string) => value === name },
      cancel: { flat: true, noCaps: true, label: 'Cancel' },
      ok: { unelevated: true, noCaps: true, color: 'negative', label: 'Delete collection' },
    }).onOk(() => {
      void store.dropCollection(name).then(() => {
        $q.notify({ position: 'top', timeout: 1500, message: `${name} deleted` });
        if (router.currentRoute.value.path.startsWith('/collection/')) {
          void router.push('/collections');
        }
      });
    });
  }

  function copySchema(collectionName: string) {
    $q.dialog({
      title: `Copy the schema of ${collectionName}`,
      message:
        'Creates an empty collection with the same fields and linked sets. Documents are not copied.',
      prompt: {
        model: `${collectionName}-copy`,
        type: 'text',
        isValid: (value: string) =>
          !!value.trim() && !store.data.collections.some((c) => c.name === value.trim()),
      },
      cancel: { flat: true, noCaps: true, label: 'Cancel' },
      ok: { unelevated: true, noCaps: true, label: 'Create copy' },
    }).onOk((destinationName: string) => {
      void store.cloneCollectionSchema({ collectionName, destinationName: destinationName.trim() });
    });
  }

  return { exportCollection, deleteCollection, copySchema };
}
