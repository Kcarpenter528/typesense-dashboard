<template>
  <q-page class="ts-page">
    <page-header
      help="collections"
      title="Collections"
      description="A collection holds documents that share a schema. Open one to search it, change its fields or add documents."
    >
      <q-btn
        unelevated
        no-caps
        color="primary"
        icon="sym_s_add"
        label="New collection"
        @click="state.createOpen = true"
      />
    </page-header>

    <q-table
      class="ts-table"
      flat
      bordered
      :filter="state.filter"
      :columns="columns"
      :rows="collectionsStore.collections"
      row-key="name"
      :pagination="{ rowsPerPage: 50, sortBy: 'name' }"
      :rows-per-page-options="[25, 50, 100, 0]"
    >
      <template #top>
        <q-input
          v-model="state.filter"
          class="ts-filter"
          dense
          outlined
          debounce="200"
          placeholder="Filter collections"
          aria-label="Filter collections"
        >
          <template #prepend><q-icon name="sym_s_search" size="18px" /></template>
        </q-input>
      </template>
      <template #body-cell-name="props">
        <q-td :props="props">
          <router-link class="collection-link text-mono" :to="`/collection/${props.value}/search`">
            {{ props.value }}
          </router-link>
          <div v-if="aliasesFor(props.value).length" class="aliases">
            <q-icon name="sym_s_alt_route" size="13px" />
            <span v-for="a in aliasesFor(props.value)" :key="a" class="text-mono">{{ a }}</span>
          </div>
        </q-td>
      </template>
      <template #body-cell-num_documents="props">
        <q-td :props="props" class="num">{{ (props.value ?? 0).toLocaleString() }}</q-td>
      </template>
      <template #body-cell-fields="props">
        <q-td :props="props">
          <span class="num">{{ props.value }}</span>
          <span v-if="props.row.enable_nested_fields" class="tag q-ml-sm">nested</span>
        </q-td>
      </template>
      <template #body-cell-sets="props">
        <q-td :props="props" class="ts-muted">{{ props.value || '—' }}</q-td>
      </template>
      <template #body-cell-created_at="props">
        <q-td :props="props" class="ts-muted">
          {{ props.value ? new Date(props.value * 1000).toLocaleDateString() : '' }}
        </q-td>
      </template>
      <template #body-cell-actions="props">
        <q-td :props="props">
          <q-btn
            flat
            round
            dense
            size="sm"
            icon="sym_s_more_horiz"
            :aria-label="`Actions for ${props.row.name}`"
          >
            <q-menu anchor="bottom right" self="top right">
              <q-list dense style="min-width: 200px">
                <q-item v-close-popup clickable :to="`/collection/${props.row.name}/search`">
                  <q-item-section avatar><q-icon name="sym_s_search" size="18px" /></q-item-section>
                  <q-item-section>Search</q-item-section>
                </q-item>
                <q-item v-close-popup clickable :to="`/collection/${props.row.name}/schema`">
                  <q-item-section avatar
                    ><q-icon name="sym_s_data_object" size="18px"
                  /></q-item-section>
                  <q-item-section>Edit schema</q-item-section>
                </q-item>
                <q-item v-close-popup clickable :to="`/collection/${props.row.name}/document`">
                  <q-item-section avatar
                    ><q-icon name="sym_s_note_add" size="18px"
                  /></q-item-section>
                  <q-item-section>Add documents</q-item-section>
                </q-item>
                <q-item v-close-popup clickable @click="actions.exportCollection(props.row.name)">
                  <q-item-section avatar
                    ><q-icon name="sym_s_download" size="18px"
                  /></q-item-section>
                  <q-item-section>Export documents</q-item-section>
                </q-item>
                <q-item v-close-popup clickable @click="actions.copySchema(props.row.name)">
                  <q-item-section avatar
                    ><q-icon name="sym_s_content_copy" size="18px"
                  /></q-item-section>
                  <q-item-section>Copy schema to a new collection</q-item-section>
                </q-item>
                <q-separator />
                <q-item
                  v-close-popup
                  clickable
                  @click="actions.deleteDocuments(props.row.name, 'filter')"
                >
                  <q-item-section avatar>
                    <q-icon name="sym_s_filter_alt_off" size="18px" />
                  </q-item-section>
                  <q-item-section>Delete documents by filter…</q-item-section>
                </q-item>
                <q-item
                  v-close-popup
                  clickable
                  :disable="!props.row.num_documents"
                  @click="actions.deleteDocuments(props.row.name, 'all')"
                >
                  <q-item-section avatar>
                    <q-icon name="sym_s_delete_sweep" size="18px" />
                  </q-item-section>
                  <q-item-section>Delete all documents…</q-item-section>
                </q-item>
                <q-item
                  v-close-popup
                  clickable
                  class="text-negative"
                  @click="actions.deleteCollection(props.row.name)"
                >
                  <q-item-section avatar><q-icon name="sym_s_delete" size="18px" /></q-item-section>
                  <q-item-section>Delete collection</q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>
        </q-td>
      </template>
      <template #no-data>
        <empty-state
          v-if="!state.filter"
          icon="sym_s_folder_data"
          title="Create your first collection"
          body="Define the fields your documents have, then import documents and start searching."
        >
          <q-btn
            unelevated
            no-caps
            color="primary"
            label="New collection"
            @click="state.createOpen = true"
          />
        </empty-state>
        <div v-else class="full-width text-center ts-faint q-pa-lg">
          No collection matches “{{ state.filter }}”.
        </div>
      </template>
    </q-table>

    <side-sheet
      v-model="state.createOpen"
      title="New collection"
      description="Add the fields you want to search, filter or sort on. Documents can hold other fields too."
      width="min(920px, 100vw)"
      persistent
    >
      <collection-ui
        primary-action-label="Create collection"
        create-mode
        @submit="createCollection"
      />
    </side-sheet>
  </q-page>
</template>

<script setup lang="ts">
import { onMounted, reactive } from 'vue';
import type { QTableProps } from 'quasar';
import type { CollectionSchema } from 'typesense/lib/Typesense/Collection';
import type { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';
import { useNodeStore } from '@/stores/node';
import { useAliasesStore } from '@/stores/aliases';
import { useCollectionsStore } from '@/stores/collections';
import { buildCreateSchema, isObjectType } from '@/shared/schemaDiff';
import { useCollectionActions } from '@/shared/useCollectionActions';
import PageHeader from '@/components/ui/PageHeader.vue';
import SideSheet from '@/components/ui/SideSheet.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import CollectionUi from '@/components/collection/CollectionUi.vue';

const store = useNodeStore();
const aliasesStore = useAliasesStore();
const collectionsStore = useCollectionsStore();
const actions = useCollectionActions();

const state = reactive({ filter: '', createOpen: false });

/** Top-level fields only; auto-detected nested sub-fields such as customer.name are left out. */
function topLevelFields(collection: CollectionSchema) {
  const fields = collection.fields ?? [];
  const objects = fields.filter((f) => isObjectType(f.type));
  return fields.filter((f) => !objects.some((o) => f.name.startsWith(`${o.name}.`))).length;
}

function setsLabel(collection: CollectionSchema) {
  const synonyms = collection.synonym_sets?.length ?? 0;
  const curations = collection.curation_sets?.length ?? 0;
  const parts = [];
  if (synonyms) parts.push(`${synonyms} synonym`);
  if (curations) parts.push(`${curations} curation`);
  return parts.join(', ');
}

const columns: QTableProps['columns'] = [
  { name: 'name', label: 'Collection', field: 'name', align: 'left', sortable: true },
  {
    name: 'num_documents',
    label: 'Documents',
    field: 'num_documents',
    align: 'right',
    sortable: true,
  },
  {
    name: 'fields',
    label: 'Fields',
    field: (row: CollectionSchema) => topLevelFields(row),
    align: 'left',
    sortable: true,
  },
  { name: 'sets', label: 'Sets', field: (row: CollectionSchema) => setsLabel(row), align: 'left' },
  { name: 'created_at', label: 'Created', field: 'created_at', align: 'left', sortable: true },
  { name: 'actions', label: '', field: 'name', align: 'right' },
];

function aliasesFor(name: string) {
  return aliasesStore.aliases.filter((a) => a.collection_name === name).map((a) => a.name);
}

async function createCollection(schema: CollectionCreateSchema) {
  await collectionsStore.createCollection(
    buildCreateSchema(schema, schema.name) as CollectionSchema,
  );
  if (!store.error) state.createOpen = false;
}

onMounted(() => {
  void collectionsStore.getCollections();
  void aliasesStore.load();
});
</script>

<style scoped lang="scss">
.collection-link {
  color: var(--ts-ink);
  font-weight: 500;
  text-decoration: none;
  font-size: 0.925rem;
  &:hover {
    color: var(--ts-primary);
  }
}

.aliases {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
  font-size: 0.75rem;
  color: var(--ts-ink-3);
}

.num {
  font-family: var(--ts-font-mono);
  font-size: 0.85rem;
}

.tag {
  padding: 1px 6px;
  border-radius: 5px;
  background: var(--ts-sheet-2);
  border: 1px solid var(--ts-rule);
  font-size: 0.72rem;
  color: var(--ts-ink-3);
}
</style>
