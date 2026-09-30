<template>
  <q-page class="ts-page">
    <page-header
      title="Search presets"
      description="A preset is a saved set of search parameters. Search with preset=name instead of repeating the same query_by, sort_by and filters in every request."
    >
      <q-btn
        unelevated
        no-caps
        color="primary"
        icon="sym_s_add"
        label="New preset"
        @click="newPreset"
      />
    </page-header>

    <q-table
      class="ts-table"
      flat
      bordered
      :filter="state.filter"
      :rows="store.data.searchPresets"
      :columns="columns"
      row-key="name"
      :pagination="{ rowsPerPage: 25, sortBy: 'name' }"
      :rows-per-page-options="[25, 50, 100, 0]"
    >
      <template #top>
        <q-input
          v-model="state.filter"
          class="ts-filter"
          dense
          outlined
          debounce="200"
          placeholder="Filter presets"
          aria-label="Filter presets"
        >
          <template #prepend><q-icon name="sym_s_search" size="18px" /></template>
        </q-input>
      </template>
      <template #body-cell-name="props">
        <q-td :props="props"
          ><code>{{ props.value }}</code></q-td
        >
      </template>
      <template #body-cell-value="props">
        <q-td :props="props">
          <div class="params">
            <span v-for="[key, value] in paramEntries(props.row.value)" :key="key" class="param">
              <span class="param__key">{{ key }}</span> = {{ value }}
            </span>
          </div>
        </q-td>
      </template>
      <template #body-cell-actions="props">
        <q-td :props="props" class="text-no-wrap">
          <q-btn
            flat
            round
            dense
            size="sm"
            icon="sym_s_edit"
            aria-label="Edit preset"
            @click="editPreset(props.row)"
          >
            <q-tooltip>Edit</q-tooltip>
          </q-btn>
          <q-btn
            flat
            round
            dense
            size="sm"
            icon="sym_s_delete"
            aria-label="Delete preset"
            class="ts-danger-hover"
            @click="deletePreset(props.row.name)"
          >
            <q-tooltip>Delete</q-tooltip>
          </q-btn>
        </q-td>
      </template>
      <template #no-data>
        <empty-state
          v-if="!state.filter"
          icon="sym_s_bookmark"
          title="Save your first search preset"
          body="Keep query_by, sort_by, facets and filters in one place so every client searches the same way."
        >
          <q-btn unelevated no-caps color="primary" label="New preset" @click="newPreset" />
        </empty-state>
        <div v-else class="full-width text-center ts-faint q-pa-lg">
          No preset matches “{{ state.filter }}”.
        </div>
      </template>
    </q-table>

    <side-sheet
      v-model="state.sheetOpen"
      :title="state.editing ? `Edit preset ${state.preset.name}` : 'New search preset'"
      description="Any search parameter works here, such as query_by, sort_by, filter_by or per_page."
      width="min(620px, 100vw)"
    >
      <q-form id="preset-form" class="column no-wrap fit" @submit="savePreset">
        <q-input
          v-model="state.preset.name"
          outlined
          label="Preset name"
          placeholder="milestone-list"
          :readonly="state.editing"
          lazy-rules
          :rules="[(val) => !!val || 'Enter a name']"
        />
        <div class="ts-eyebrow q-mb-xs">Search parameters</div>
        <div class="json-editor">
          <monaco-editor v-model="presetJson" />
        </div>
        <div v-if="state.jsonError" class="text-negative text-caption q-mt-xs">
          {{ state.jsonError }}
        </div>
        <q-btn
          flat
          dense
          no-caps
          color="primary"
          icon="sym_s_open_in_new"
          label="Search parameters in the Typesense docs"
          class="self-start q-mt-sm"
          :href="`https://typesense.org/docs/${store.data.debug.version || store.data.defaultDocVersion}/api/search.html#presets`"
          target="_blank"
        />
      </q-form>
      <template #actions>
        <q-btn v-close-popup flat no-caps label="Cancel" />
        <q-btn
          unelevated
          no-caps
          color="primary"
          type="submit"
          form="preset-form"
          :label="state.editing ? 'Save preset' : 'Create preset'"
          :disable="!!state.jsonError"
        />
      </template>
    </side-sheet>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive } from 'vue';
import { useQuasar } from 'quasar';
import type { QTableProps } from 'quasar';
import type { PresetSchema } from 'typesense/lib/Typesense/Preset';
import { useNodeStore } from '@/stores/node';
import MonacoEditor from '@/components/MonacoEditor.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import SideSheet from '@/components/ui/SideSheet.vue';
import EmptyState from '@/components/ui/EmptyState.vue';

interface PresetDraft {
  name: string;
  value: Record<string, unknown>;
}

const $q = useQuasar();
const store = useNodeStore();

const EXAMPLE: Record<string, unknown> = {
  query_by: 'title,description',
  sort_by: '_text_match:desc',
  per_page: 20,
};

const state = reactive<{
  preset: PresetDraft;
  jsonError: string | null;
  sheetOpen: boolean;
  editing: boolean;
  filter: string;
}>({
  preset: { name: '', value: { ...EXAMPLE } },
  jsonError: null,
  sheetOpen: false,
  editing: false,
  filter: '',
});

const columns: QTableProps['columns'] = [
  { label: 'Preset', name: 'name', field: 'name', align: 'left', sortable: true },
  {
    label: 'Parameters',
    name: 'value',
    field: (row: PresetSchema<Record<string, unknown>>) => JSON.stringify(row.value),
    align: 'left',
  },
  { label: '', name: 'actions', field: 'name', align: 'right' },
];

const presetJson = computed({
  get: () => JSON.stringify(state.preset.value, null, 2),
  set: (json: string) => {
    try {
      const parsed: unknown = JSON.parse(json);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        state.jsonError = 'Parameters must be a JSON object.';
        return;
      }
      state.preset.value = parsed as Record<string, unknown>;
      state.jsonError = null;
    } catch (e) {
      state.jsonError = `This isn't valid JSON yet: ${(e as Error).message}`;
    }
  },
});

function paramEntries(value: unknown): [string, string][] {
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value as Record<string, unknown>).map(([k, v]) => [
    k,
    typeof v === 'string' ? v : JSON.stringify(v),
  ]);
}

function newPreset() {
  state.preset = { name: '', value: { ...EXAMPLE } };
  state.jsonError = null;
  state.editing = false;
  state.sheetOpen = true;
}

function editPreset(preset: PresetSchema<Record<string, unknown>>) {
  state.preset = JSON.parse(JSON.stringify({ name: preset.name, value: preset.value }));
  state.jsonError = null;
  state.editing = true;
  state.sheetOpen = true;
}

async function savePreset() {
  const message = state.editing ? 'Preset saved' : 'Preset created';
  await store.upsertSearchPreset(JSON.parse(JSON.stringify(state.preset)));
  if (!store.error) {
    state.sheetOpen = false;
    $q.notify({ type: 'positive', message, position: 'top', timeout: 1500 });
  }
}

function deletePreset(name: string) {
  $q.dialog({
    title: `Delete preset ${name}?`,
    message: 'Searches that use this preset will fail until they stop referring to it.',
    cancel: { flat: true, noCaps: true, label: 'Cancel' },
    ok: { unelevated: true, noCaps: true, color: 'negative', label: 'Delete preset' },
  }).onOk(() => {
    void store.deleteSearchPreset(name);
  });
}

onMounted(() => {
  void store.getSearchPresets();
});
</script>

<style scoped lang="scss">
.params {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  font-family: var(--ts-font-mono);
  font-size: 0.8rem;
  color: var(--ts-ink);
  white-space: normal;
}

.param__key {
  color: var(--ts-ink-3);
}

.json-editor {
  flex: 1;
  min-height: 280px;
  display: flex;
  border: 1px solid var(--ts-rule);
  border-radius: 8px;
  overflow: hidden;
}
</style>
