<template>
  <q-list bordered class="rounded-borders">
    <q-expansion-item
      expand-separator
      icon="sym_s_library_add"
      expand-icon="sym_s_unfold_more"
      expanded-icon="sym_s_unfold_less"
      label="Add Collection"
      header-class="bg-primary text-white"
    >
      <collection-ui
        primary-action-label="Create Collection"
        create-mode
        @submit="createCollection"
      />
    </q-expansion-item>
  </q-list>
</template>

<script setup lang="ts">
import type { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';
import { useNodeStore } from '@/stores/node';
import type { CollectionSchema } from 'typesense/lib/Typesense/Collection';
import { buildCreateSchema } from '@/shared/schemaDiff';
import CollectionUi from './CollectionUi.vue';

const store = useNodeStore();

function createCollection(schemaToCreate: CollectionCreateSchema) {
  const schema = buildCreateSchema(schemaToCreate, schemaToCreate.name);
  void store.createCollection(schema as CollectionSchema);
}
</script>
