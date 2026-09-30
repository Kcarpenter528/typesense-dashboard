<template>
  <q-page class="ts-page">
    <collection-ui :initial-schema="schema" primary-action-label="Save schema" @submit="update" />
  </q-page>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useQuasar } from 'quasar';
import { useCollectionsStore } from '@/stores/collections';
import CollectionUi from '@/components/collection/CollectionUi.vue';
import type { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';
import type { CollectionSchema } from 'typesense/lib/Typesense/Collection';
import SchemaChangeDialog from '@/components/collection/SchemaChangeDialog.vue';
import { diffSchema } from '@/shared/schemaDiff';

const $q = useQuasar();
const collectionsStore = useCollectionsStore();

const schema = computed<CollectionSchema | CollectionCreateSchema>(() => {
  const collection = collectionsStore.currentCollection;
  if (collection) {
    const schema: any = {
      name: collection.name,
      fields: collection.fields?.map((f: any) => {
        const knownKeys = ['name', 'type', 'facet', 'optional', 'index', 'sort', 'infix', 'locale'];
        const missingKeys = Object.keys(f).filter((k) => !knownKeys.includes(k));

        return knownKeys.concat(missingKeys).reduce((acc, key: any) => {
          acc[key] = f[key];
          return acc;
        }, {} as any);
      }),
      default_sorting_field: collection.default_sorting_field,
    };

    const otherKeys = Object.keys(collection).filter(
      (k) =>
        !['name', 'fields', 'default_sorting_field', 'created_at', 'num_documents'].includes(k),
    );
    otherKeys.forEach((k: any) => {
      // @ts-expect-error any
      schema[k] = collection[k];
    });

    return schema;
  }
  return {
    name: '',
    fields: [],
    default_sorting_field: '',
    token_separators: [],
    symbols_to_index: [],
    enable_nested_fields: false,
  };
});

function update(editedSchema: CollectionCreateSchema) {
  const collection = collectionsStore.currentCollection;
  if (!collection) return;

  const plan = diffSchema(collection, editedSchema);

  if (plan.errors.length) {
    $q.dialog({
      title: 'Cannot update schema',
      message: plan.errors.map((e) => `• ${e}`).join('\n'),
      style: 'white-space: pre-line',
    });
    return;
  }
  if (!plan.hasChanges) {
    $q.notify({ message: 'No changes to apply', color: 'grey-8', position: 'top', timeout: 1500 });
    return;
  }

  $q.dialog({
    component: SchemaChangeDialog,
    componentProps: {
      plan,
      collectionName: collection.name,
      documentCount: collection.num_documents ?? 0,
      editedSchema,
    },
  }).onOk(() => {
    $q.notify({ message: 'Schema updated', color: 'positive', position: 'top', timeout: 1500 });
  });
}
</script>
