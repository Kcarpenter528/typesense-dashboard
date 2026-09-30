<template>
  <q-page class="ts-page">
    <page-header
      title="Stopwords"
      description="Stopwords are common words such as the, a or of that searches can ignore. Use a set with the stopwords search parameter."
    >
      <q-btn unelevated no-caps color="primary" icon="sym_s_add" label="New set" @click="newSet" />
    </page-header>

    <q-table
      class="ts-table"
      flat
      bordered
      wrap-cells
      :filter="state.filter"
      :rows="store.data.stopwords"
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
          placeholder="Filter sets"
          aria-label="Filter stopword sets"
        >
          <template #prepend><q-icon name="sym_s_search" size="18px" /></template>
        </q-input>
      </template>
      <template #body-cell-id="props">
        <q-td :props="props"
          ><code>{{ props.value }}</code></q-td
        >
      </template>
      <template #body-cell-stopwords="props">
        <q-td :props="props">
          <div class="words">
            <span v-for="word in wordsOf(props.row).slice(0, 40)" :key="word" class="word">
              {{ word }}
            </span>
            <span v-if="wordsOf(props.row).length > 40" class="ts-faint">
              and {{ wordsOf(props.row).length - 40 }} more
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
            aria-label="Edit set"
            @click="editSet(props.row)"
          >
            <q-tooltip>Edit</q-tooltip>
          </q-btn>
          <q-btn
            flat
            round
            dense
            size="sm"
            icon="sym_s_delete"
            aria-label="Delete set"
            class="ts-danger-hover"
            @click="deleteSet(props.row.id)"
          >
            <q-tooltip>Delete</q-tooltip>
          </q-btn>
        </q-td>
      </template>
      <template #no-data>
        <empty-state
          v-if="!state.filter"
          icon="sym_s_format_strikethrough"
          title="Create a stopword set"
          body="Leaving out filler words makes long queries match on the words that matter."
        >
          <q-btn unelevated no-caps color="primary" label="New set" @click="newSet" />
        </empty-state>
        <div v-else class="full-width text-center ts-faint q-pa-lg">
          No set matches “{{ state.filter }}”.
        </div>
      </template>
    </q-table>

    <side-sheet
      v-model="state.sheetOpen"
      :title="state.editing ? `Edit set ${state.set.id}` : 'New stopword set'"
      description="Type a word and press Enter to add it. Paste a comma-separated list to add many at once."
    >
      <q-form id="stopwords-form" class="column q-gutter-md" @submit="saveSet">
        <q-input
          v-model="state.set.id"
          outlined
          label="Set name"
          placeholder="english-common"
          :readonly="state.editing"
          lazy-rules
          :rules="[(val) => !!val || 'Enter a name']"
        />
        <q-input
          v-model="state.set.locale"
          outlined
          label="Locale"
          placeholder="en"
          hint="Language code of the words, for correct tokenizing."
        />
        <q-select
          v-model="state.set.stopwords"
          outlined
          multiple
          use-chips
          use-input
          new-value-mode="add-unique"
          hide-dropdown-icon
          input-debounce="0"
          label="Words"
          lazy-rules
          :rules="[(v) => (v && v.length > 0) || 'Add at least one word']"
          @new-value="addWords"
        />
      </q-form>
      <template #actions>
        <q-btn v-close-popup flat no-caps label="Cancel" />
        <q-btn
          unelevated
          no-caps
          color="primary"
          type="submit"
          form="stopwords-form"
          :label="state.editing ? 'Save set' : 'Create set'"
        />
      </template>
    </side-sheet>
  </q-page>
</template>

<script setup lang="ts">
import { onMounted, reactive } from 'vue';
import { useQuasar } from 'quasar';
import type { QTableProps } from 'quasar';
import type { StopwordSchema } from 'typesense/lib/Typesense/Stopword';
import { useNodeStore } from '@/stores/node';
import PageHeader from '@/components/ui/PageHeader.vue';
import SideSheet from '@/components/ui/SideSheet.vue';
import EmptyState from '@/components/ui/EmptyState.vue';

interface StopwordDraft {
  id: string;
  locale: string;
  stopwords: string[];
}

const $q = useQuasar();
const store = useNodeStore();

const state = reactive<{
  set: StopwordDraft;
  sheetOpen: boolean;
  editing: boolean;
  filter: string;
}>({
  set: { id: '', locale: 'en', stopwords: [] },
  sheetOpen: false,
  editing: false,
  filter: '',
});

const columns: QTableProps['columns'] = [
  { label: 'Set', name: 'id', field: 'id', align: 'left', sortable: true },
  { label: 'Locale', name: 'locale', field: 'locale', align: 'left', sortable: true },
  {
    label: 'Words',
    name: 'stopwords',
    field: (row: StopwordSchema) => wordsOf(row).join(' '),
    align: 'left',
  },
  { label: '', name: 'actions', field: 'id', align: 'right' },
];

/** The Typesense types allow the words to arrive nested; the API returns a plain list. */
function wordsOf(set: StopwordSchema): string[] {
  const words = set.stopwords as unknown;
  if (Array.isArray(words)) return words as string[];
  return (words as { stopwords?: string[] }).stopwords ?? [];
}

/** Accepts one word or a pasted comma/newline separated list. */
function addWords(
  value: string,
  done: (item?: string, mode?: 'add' | 'add-unique' | 'toggle') => void,
) {
  const words = value
    .split(/[,\n]/)
    .map((w) => w.trim())
    .filter(Boolean);
  const [last, ...rest] = words.reverse();
  for (const word of rest.reverse()) {
    if (!state.set.stopwords.includes(word)) state.set.stopwords.push(word);
  }
  done(last, 'add-unique');
}

function newSet() {
  state.set = { id: '', locale: 'en', stopwords: [] };
  state.editing = false;
  state.sheetOpen = true;
}

function editSet(set: StopwordSchema) {
  state.set = {
    id: set.id,
    locale: (set as StopwordSchema & { locale?: string }).locale ?? '',
    stopwords: [...wordsOf(set)],
  };
  state.editing = true;
  state.sheetOpen = true;
}

async function saveSet() {
  const message = state.editing ? 'Stopword set saved' : 'Stopword set created';
  await store.upsertStopwords(JSON.parse(JSON.stringify(state.set)));
  if (!store.error) {
    state.sheetOpen = false;
    $q.notify({ type: 'positive', message, position: 'top', timeout: 1500 });
  }
}

function deleteSet(id: string) {
  $q.dialog({
    title: `Delete stopword set ${id}?`,
    message: 'Searches that use this set will fail until they stop referring to it.',
    cancel: { flat: true, noCaps: true, label: 'Cancel' },
    ok: { unelevated: true, noCaps: true, color: 'negative', label: 'Delete set' },
  }).onOk(() => {
    void store.deleteStopwords(id);
  });
}

onMounted(() => {
  void store.getStopwords();
});
</script>

<style scoped lang="scss">
.words {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.word {
  padding: 1px 8px;
  border-radius: 6px;
  background: var(--ts-sheet-2);
  border: 1px solid var(--ts-rule);
  font-size: 0.8rem;
  color: var(--ts-ink-2);
}
</style>
