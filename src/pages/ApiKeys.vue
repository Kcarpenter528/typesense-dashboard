<template>
  <q-page class="ts-page">
    <page-header
      title="API keys"
      description="Give each app or service its own key with only the permissions it needs. A key's value is shown once, when it's created."
    >
      <q-btn unelevated no-caps color="primary" icon="sym_s_add" label="New key" @click="newKey" />
    </page-header>

    <q-table
      class="ts-table"
      flat
      bordered
      :filter="state.filter"
      :rows="store.data.apiKeys"
      :columns="columns"
      row-key="id"
      :pagination="{ rowsPerPage: 25, sortBy: 'id' }"
      :rows-per-page-options="[25, 50, 100, 0]"
    >
      <template #top>
        <q-input
          v-model="state.filter"
          class="ts-filter"
          dense
          outlined
          debounce="200"
          placeholder="Filter keys"
          aria-label="Filter keys"
        >
          <template #prepend><q-icon name="sym_s_search" size="18px" /></template>
        </q-input>
      </template>
      <template #body-cell-value_prefix="props">
        <q-td :props="props">
          <code>{{ props.value }}…</code>
        </q-td>
      </template>
      <template #body-cell-description="props">
        <q-td :props="props" class="key-description">
          {{ props.value || '—' }}
          <div class="ts-faint text-caption">ID {{ props.row.id }}</div>
        </q-td>
      </template>
      <template #body-cell-actions="props">
        <q-td :props="props">
          <div class="chips">
            <span
              v-for="a in props.row.actions"
              :key="a"
              class="chip"
              :class="{ 'is-broad': isBroad(a) }"
            >
              {{ a }}
            </span>
          </div>
        </q-td>
      </template>
      <template #body-cell-collections="props">
        <q-td :props="props">
          <div class="chips">
            <span
              v-for="c in props.row.collections"
              :key="c"
              class="chip"
              :class="{ 'is-broad': isBroad(c) }"
            >
              {{ c }}
            </span>
          </div>
        </q-td>
      </template>
      <template #body-cell-expires_at="props">
        <q-td :props="props">
          <span :class="{ 'text-negative': isExpired(props.row.expires_at) }">
            {{ expiryLabel(props.row.expires_at) }}
          </span>
        </q-td>
      </template>
      <template #body-cell-delete="props">
        <q-td :props="props">
          <q-btn
            flat
            round
            dense
            size="sm"
            icon="sym_s_delete"
            aria-label="Delete key"
            class="ts-danger-hover"
            @click="deleteApiKey(props.row)"
          >
            <q-tooltip>Delete</q-tooltip>
          </q-btn>
        </q-td>
      </template>
      <template #no-data>
        <empty-state
          v-if="!state.filter"
          icon="sym_s_key"
          title="Create a key for your app"
          body="A search-only key scoped to your collections is safe to use in a browser. Keep admin keys on your servers."
        >
          <q-btn unelevated no-caps color="primary" label="New key" @click="newKey" />
        </empty-state>
        <div v-else class="full-width text-center ts-faint q-pa-lg">
          No key matches “{{ state.filter }}”.
        </div>
      </template>
    </q-table>

    <side-sheet
      v-model="state.sheetOpen"
      title="New API key"
      description="Choose what the key may do and which collections it can reach."
      width="min(620px, 100vw)"
    >
      <div class="ts-eyebrow q-mb-sm">Start from</div>
      <div class="templates q-mb-lg">
        <button
          v-for="t in templates"
          :key="t.id"
          type="button"
          class="template"
          :class="{ 'is-selected': state.template === t.id }"
          @click="applyTemplate(t.id)"
        >
          <q-icon :name="t.icon" size="20px" />
          <span class="template__name">{{ t.name }}</span>
          <span class="template__hint">{{ t.hint }}</span>
        </button>
      </div>

      <q-form id="key-form" class="column q-gutter-md" @submit="createApiKey">
        <q-input
          v-model="state.key.description"
          outlined
          label="Description"
          placeholder="Search key for the web app"
          lazy-rules
          :rules="[(v) => !!v || 'Describe what the key is for']"
        />
        <q-select
          v-model="state.key.actions"
          outlined
          multiple
          use-chips
          use-input
          new-value-mode="add-unique"
          input-debounce="0"
          label="Permissions"
          :options="ACTION_OPTIONS"
          hint="documents:search is enough for searching. * allows everything."
          lazy-rules
          :rules="[(v) => (v && v.length > 0) || 'Choose at least one permission']"
        />
        <q-select
          v-model="state.key.collections"
          outlined
          multiple
          use-chips
          use-input
          new-value-mode="add-unique"
          input-debounce="0"
          label="Collections"
          :options="collectionOptions"
          hint="Names, aliases or regular expressions such as orders_.*. * means every collection."
          lazy-rules
          :rules="[(v) => (v && v.length > 0) || 'Choose at least one collection']"
        />
        <q-input
          v-model="state.expiresOn"
          outlined
          type="date"
          label="Expires on"
          stack-label
          clearable
          hint="Leave empty for a key that never expires."
        />
      </q-form>

      <q-expansion-item
        dense
        switch-toggle-side
        class="q-mt-lg"
        header-class="q-px-none ts-muted"
        label="Edit as JSON"
        caption="For options such as autodelete or embedded search parameters"
      >
        <div class="json-editor q-mt-sm">
          <monaco-editor v-model="keyJson" />
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
          label="API key options in the Typesense docs"
          class="q-mt-sm"
          :href="`https://typesense.org/docs/${store.data.debug.version || store.data.defaultDocVersion}/api/api-keys.html#create-an-api-key`"
          target="_blank"
        />
      </q-expansion-item>

      <template #actions>
        <q-btn v-close-popup flat no-caps label="Cancel" />
        <q-btn
          unelevated
          no-caps
          color="primary"
          type="submit"
          form="key-form"
          label="Create key"
          :loading="state.saving"
          :disable="!!state.jsonError"
        />
      </template>
    </side-sheet>

    <q-dialog v-model="state.createdOpen" persistent>
      <q-card class="created-card">
        <q-card-section>
          <div class="ts-section-title">Copy your new key</div>
          <p class="ts-muted q-mt-sm q-mb-md">
            This is the only time the full key is shown. Store it somewhere safe, such as your app's
            secret settings.
          </p>
          <div class="key-value row no-wrap items-center">
            <code class="col">{{ state.createdValue }}</code>
            <q-btn flat dense no-caps icon="sym_s_content_copy" label="Copy" @click="copyKey" />
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn v-close-popup unelevated no-caps color="primary" label="I've copied it" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive } from 'vue';
import { copyToClipboard, useQuasar } from 'quasar';
import type { QTableProps } from 'quasar';
import type { KeyCreateSchema, KeySchema } from 'typesense/lib/Typesense/Key';
import { useNodeStore } from '@/stores/node';
import MonacoEditor from '@/components/MonacoEditor.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import SideSheet from '@/components/ui/SideSheet.vue';
import EmptyState from '@/components/ui/EmptyState.vue';

const $q = useQuasar();
const store = useNodeStore();

/** Typesense's value for "never expires". */
const NEVER = 64723363199;

const ACTION_OPTIONS = [
  'documents:search',
  'documents:get',
  'documents:create',
  'documents:upsert',
  'documents:update',
  'documents:delete',
  'documents:import',
  'documents:export',
  'documents:*',
  'collections:list',
  'collections:get',
  'collections:create',
  'collections:delete',
  'collections:*',
  'aliases:*',
  'synonyms:*',
  'overrides:*',
  'keys:*',
  'metrics.json:list',
  'stats.json:list',
  '*',
];

type TemplateId = 'search' | 'write' | 'admin';

const templates: { id: TemplateId; name: string; hint: string; icon: string }[] = [
  { id: 'search', name: 'Search only', hint: 'Safe for browsers', icon: 'sym_s_search' },
  { id: 'write', name: 'Read and write', hint: 'For ingest jobs', icon: 'sym_s_edit_document' },
  { id: 'admin', name: 'Admin', hint: 'Everything, server only', icon: 'sym_s_shield_person' },
];

const TEMPLATE_KEYS: Record<TemplateId, KeyCreateSchema> = {
  search: { description: '', actions: ['documents:search'], collections: [] },
  write: { description: '', actions: ['documents:*'], collections: [] },
  admin: { description: 'Admin key', actions: ['*'], collections: ['*'] },
};

interface PageState {
  key: KeyCreateSchema;
  template: TemplateId | null;
  expiresOn: string | null;
  jsonError: string | null;
  sheetOpen: boolean;
  saving: boolean;
  createdOpen: boolean;
  createdValue: string;
  filter: string;
}

const state = reactive<PageState>({
  key: structuredClone(TEMPLATE_KEYS.search),
  template: 'search',
  expiresOn: null,
  jsonError: null,
  sheetOpen: false,
  saving: false,
  createdOpen: false,
  createdValue: '',
  filter: '',
});

const columns: QTableProps['columns'] = [
  { label: 'Key', name: 'value_prefix', field: 'value_prefix', align: 'left' },
  {
    label: 'Description',
    name: 'description',
    field: 'description',
    align: 'left',
    sortable: true,
  },
  {
    label: 'Permissions',
    name: 'actions',
    field: (row: KeySchema) => row.actions.join(' '),
    align: 'left',
  },
  {
    label: 'Collections',
    name: 'collections',
    field: (row: KeySchema) => row.collections.join(' '),
    align: 'left',
  },
  {
    label: 'Expires',
    name: 'expires_at',
    field: 'expires_at',
    align: 'left',
    sortable: true,
  },
  { label: '', name: 'delete', field: 'id', align: 'right' },
];

const collectionOptions = computed(() => [
  '*',
  ...store.data.aliases.map((a) => a.name),
  ...store.data.collections.map((c) => c.name).sort(),
]);

const keyJson = computed({
  get: () => JSON.stringify(state.key, null, 2),
  set: (json: string) => {
    try {
      state.key = JSON.parse(json);
      state.jsonError = null;
      state.template = null;
    } catch (e) {
      state.jsonError = `This isn't valid JSON yet: ${(e as Error).message}`;
    }
  },
});

function isBroad(value: string) {
  return value === '*' || value.endsWith(':*');
}

function isExpired(expiresAt?: number) {
  return !!expiresAt && expiresAt !== NEVER && expiresAt * 1000 < Date.now();
}

function expiryLabel(expiresAt?: number) {
  if (!expiresAt || expiresAt === NEVER) return 'Never';
  const date = new Date(expiresAt * 1000).toLocaleDateString();
  return isExpired(expiresAt) ? `Expired ${date}` : date;
}

function applyTemplate(id: TemplateId) {
  const description = state.key.description;
  state.key = structuredClone(TEMPLATE_KEYS[id]);
  if (description && id !== 'admin') state.key.description = description;
  state.template = id;
  state.jsonError = null;
}

function newKey() {
  applyTemplate('search');
  state.key.description = '';
  state.expiresOn = null;
  state.sheetOpen = true;
}

async function createApiKey() {
  const payload: KeyCreateSchema = JSON.parse(JSON.stringify(state.key));
  if (state.expiresOn) {
    payload.expires_at = Math.floor(new Date(`${state.expiresOn}T23:59:59`).getTime() / 1000);
  }
  state.saving = true;
  let key: KeySchema | undefined;
  try {
    key = await store.createApiKey(payload as KeySchema);
  } catch {
    // The store shows the server's error message in the banner.
    return;
  } finally {
    state.saving = false;
  }
  if (key?.value) {
    state.sheetOpen = false;
    state.createdValue = key.value;
    state.createdOpen = true;
  }
}

function copyKey() {
  copyToClipboard(state.createdValue)
    .then(() => $q.notify({ message: 'Key copied', position: 'top', timeout: 1200 }))
    .catch(() => $q.notify({ type: 'negative', message: 'Could not copy to the clipboard' }));
}

function deleteApiKey(key: KeySchema) {
  $q.dialog({
    title: `Delete key ${key.value_prefix}…?`,
    message: `${key.description || 'This key'} stops working immediately. This can't be undone.`,
    cancel: { flat: true, noCaps: true, label: 'Cancel' },
    ok: { unelevated: true, noCaps: true, color: 'negative', label: 'Delete key' },
  }).onOk(() => {
    void store.deleteApiKey(String(key.id));
  });
}

onMounted(() => {
  void store.getApiKeys();
});
</script>

<style scoped lang="scss">
.key-description {
  white-space: normal;
  min-width: 180px;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  max-width: 320px;
}

.chip {
  font-family: var(--ts-font-mono);
  font-size: 0.75rem;
  padding: 1px 7px;
  border-radius: 6px;
  background: var(--ts-sheet-2);
  border: 1px solid var(--ts-rule);
  color: var(--ts-ink-2);
  &.is-broad {
    background: var(--ts-warning-soft);
    border-color: transparent;
    color: var(--ts-ink);
  }
}

.templates {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 8px;
}

.template {
  display: grid;
  gap: 2px;
  justify-items: start;
  padding: 12px;
  text-align: left;
  font: inherit;
  color: var(--ts-ink);
  background: var(--ts-sheet);
  border: 1px solid var(--ts-rule);
  border-radius: 10px;
  cursor: pointer;
  .q-icon {
    color: var(--ts-ink-3);
    margin-bottom: 6px;
  }
  &:hover {
    border-color: var(--ts-rule-strong);
  }
  &.is-selected {
    border-color: var(--ts-primary);
    box-shadow: 0 0 0 1px var(--ts-primary);
    .q-icon {
      color: var(--ts-primary);
    }
  }
}

.template__name {
  font-weight: 500;
  font-size: 0.9rem;
}

.template__hint {
  font-size: 0.78rem;
  color: var(--ts-ink-3);
}

.json-editor {
  height: 220px;
  display: flex;
  border: 1px solid var(--ts-rule);
  border-radius: 8px;
  overflow: hidden;
}

.created-card {
  width: min(560px, 94vw);
}

.key-value {
  gap: 8px;
  padding: 10px 10px 10px 14px;
  border-radius: 8px;
  background: var(--ts-sheet-2);
  border: 1px solid var(--ts-rule);
  code {
    word-break: break-all;
  }
}
</style>
