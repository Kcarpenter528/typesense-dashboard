<template>
  <q-page class="ts-page">
    <page-header
      title="Aliases"
      description="An alias is a second name for a collection. Point your app at the alias, then switch it to a new collection without changing code."
    >
      <q-btn
        unelevated
        no-caps
        color="primary"
        icon="sym_s_add"
        label="New alias"
        @click="newAlias"
      />
    </page-header>

    <q-table
      class="ts-table"
      flat
      bordered
      :filter="state.filter"
      :rows="store.data.aliases"
      :columns="columns"
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
          placeholder="Filter aliases"
          aria-label="Filter aliases"
        >
          <template #prepend><q-icon name="sym_s_search" size="18px" /></template>
        </q-input>
      </template>
      <template #body-cell-name="props">
        <q-td :props="props"
          ><code>{{ props.value }}</code></q-td
        >
      </template>
      <template #body-cell-collection_name="props">
        <q-td :props="props">
          <router-link class="ts-link text-mono" :to="`/collection/${props.value}/search`">
            {{ props.value }}
          </router-link>
        </q-td>
      </template>
      <template #body-cell-actions="props">
        <q-td :props="props">
          <q-btn
            flat
            round
            dense
            size="sm"
            icon="sym_s_edit"
            aria-label="Edit alias"
            @click="editAlias(props.row)"
          >
            <q-tooltip>Change target</q-tooltip>
          </q-btn>
          <q-btn
            flat
            round
            dense
            size="sm"
            icon="sym_s_delete"
            aria-label="Delete alias"
            class="ts-danger-hover"
            @click="deleteAlias(props.row.name)"
          >
            <q-tooltip>Delete</q-tooltip>
          </q-btn>
        </q-td>
      </template>
      <template #no-data>
        <empty-state
          v-if="!state.filter"
          icon="sym_s_alt_route"
          title="Create your first alias"
          body="Search against an alias like products, then reindex into products_v2 and move the alias when it's ready."
        >
          <q-btn unelevated no-caps color="primary" label="New alias" @click="newAlias" />
        </empty-state>
        <div v-else class="full-width text-center ts-faint q-pa-lg">
          No alias matches “{{ state.filter }}”.
        </div>
      </template>
    </q-table>

    <side-sheet
      v-model="state.sheetOpen"
      :title="isUpdate ? `Change alias ${state.alias.name}` : 'New alias'"
      description="Requests to the alias go to the collection it points to."
    >
      <q-form id="alias-form" class="column q-gutter-md" @submit="saveAlias">
        <q-input
          v-model="state.alias.name"
          outlined
          label="Alias name"
          placeholder="products"
          :readonly="state.editing"
          lazy-rules
          :rules="[
            (name) => !!name || 'Enter a name',
            (name) => !collectionNames.includes(name) || 'A collection already has this name',
          ]"
        />
        <q-select
          v-model="state.alias.collection_name"
          outlined
          label="Points to collection"
          :options="collectionNames"
          lazy-rules
          :rules="[(name) => !!name || 'Choose a collection']"
        />
      </q-form>
      <template #actions>
        <q-btn v-close-popup flat no-caps label="Cancel" />
        <q-btn
          unelevated
          no-caps
          color="primary"
          type="submit"
          form="alias-form"
          :label="isUpdate ? 'Save alias' : 'Create alias'"
        />
      </template>
    </side-sheet>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive } from 'vue';
import { useQuasar } from 'quasar';
import type { QTableProps } from 'quasar';
import type { CollectionAliasSchema } from 'typesense/lib/Typesense/Aliases';
import { useNodeStore } from '@/stores/node';
import PageHeader from '@/components/ui/PageHeader.vue';
import SideSheet from '@/components/ui/SideSheet.vue';
import EmptyState from '@/components/ui/EmptyState.vue';

const $q = useQuasar();
const store = useNodeStore();

const state = reactive({
  alias: { name: '', collection_name: '' },
  sheetOpen: false,
  editing: false,
  filter: '',
});

const columns: QTableProps['columns'] = [
  { label: 'Alias', name: 'name', field: 'name', align: 'left', sortable: true },
  {
    label: 'Points to',
    name: 'collection_name',
    field: 'collection_name',
    align: 'left',
    sortable: true,
  },
  { label: '', name: 'actions', field: 'name', align: 'right' },
];

const collectionNames = computed(() =>
  store.data.collections.map((collection) => collection.name).sort(),
);
const isUpdate = computed(() => store.data.aliases.some((a) => a.name === state.alias.name));

function newAlias() {
  state.alias = { name: '', collection_name: '' };
  state.editing = false;
  state.sheetOpen = true;
}

function editAlias(alias: CollectionAliasSchema) {
  state.alias = { name: alias.name, collection_name: alias.collection_name };
  state.editing = true;
  state.sheetOpen = true;
}

async function saveAlias() {
  const saved = isUpdate.value ? 'Alias updated' : 'Alias created';
  await store.createAlias({ ...state.alias });
  if (!store.error) {
    state.sheetOpen = false;
    $q.notify({ type: 'positive', message: saved, position: 'top', timeout: 1500 });
  }
}

function deleteAlias(name: string) {
  $q.dialog({
    title: `Delete alias ${name}?`,
    message: 'Anything still using this alias will stop finding its collection.',
    cancel: { flat: true, noCaps: true, label: 'Cancel' },
    ok: { unelevated: true, noCaps: true, color: 'negative', label: 'Delete alias' },
  }).onOk(() => {
    void store.deleteAlias(name);
  });
}

onMounted(() => {
  void store.getAliases();
});
</script>
