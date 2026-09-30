<template>
  <q-page class="ts-page">
    <page-header
      title="Stemming"
      description="A stemming dictionary maps words to their root, such as people → person, so a search for one finds the other. Attach it to a field with stem_dictionary in the schema."
    >
      <q-btn
        unelevated
        no-caps
        color="primary"
        icon="sym_s_add"
        label="New dictionary"
        @click="newDictionary"
      />
    </page-header>

    <q-table
      class="ts-table"
      flat
      bordered
      :filter="state.filter"
      :rows="rows"
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
          placeholder="Filter dictionaries"
          aria-label="Filter dictionaries"
        >
          <template #prepend><q-icon name="sym_s_search" size="18px" /></template>
        </q-input>
      </template>
      <template #body-cell-id="props">
        <q-td :props="props"
          ><code>{{ props.value }}</code></q-td
        >
      </template>
      <template #body-cell-usedBy="props">
        <q-td :props="props">
          <span v-if="!props.value.length" class="ts-faint">Not used by any field</span>
          <code v-for="f in props.value" :key="f" class="q-mr-sm">{{ f }}</code>
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
            aria-label="Edit dictionary"
            @click="editDictionary(props.row.id)"
          >
            <q-tooltip>Edit</q-tooltip>
          </q-btn>
          <q-btn
            flat
            round
            dense
            size="sm"
            icon="sym_s_delete"
            aria-label="Delete dictionary"
            class="ts-danger-hover"
            @click="deleteDictionary(props.row.id)"
          >
            <q-tooltip>Delete</q-tooltip>
          </q-btn>
        </q-td>
      </template>
      <template #no-data>
        <empty-state
          v-if="!state.filter"
          icon="sym_s_spellcheck"
          title="Create a stemming dictionary"
          body="Useful for irregular words the built-in stemmer misses, such as children → child."
        >
          <q-btn unelevated no-caps color="primary" label="New dictionary" @click="newDictionary" />
        </empty-state>
        <div v-else class="full-width text-center ts-faint q-pa-lg">
          No dictionary matches “{{ state.filter }}”.
        </div>
      </template>
    </q-table>

    <side-sheet
      v-model="state.sheetOpen"
      :title="state.editing ? `Edit ${state.id}` : 'New stemming dictionary'"
      description="Each pair maps a word to the root it should match."
      width="min(620px, 100vw)"
    >
      <q-form id="stemming-form" class="column q-gutter-md" @submit="saveDictionary">
        <q-input
          v-model="state.id"
          outlined
          label="Dictionary name"
          placeholder="irregular-plurals"
          :readonly="state.editing"
          lazy-rules
          :rules="[(val) => !!val || 'Enter a name']"
        />

        <div>
          <div class="row items-center justify-between q-mb-sm">
            <div class="ts-eyebrow">{{ state.pairs.length }} word pairs</div>
            <div class="row q-gutter-xs">
              <q-btn
                flat
                dense
                no-caps
                size="sm"
                icon="sym_s_upload_file"
                label="Import file"
                @click="fileInput?.click()"
              />
              <q-btn
                flat
                dense
                no-caps
                size="sm"
                icon="sym_s_add"
                label="Add pair"
                @click="addPair"
              />
            </div>
          </div>
          <input
            ref="fileInput"
            type="file"
            accept=".jsonl,.json,.txt"
            class="hidden"
            @change="importFile"
          />

          <div class="pairs">
            <div class="pairs__head row no-wrap">
              <div class="col">Word</div>
              <div class="pairs__arrow" />
              <div class="col">Root</div>
              <div class="pairs__remove" />
            </div>
            <div
              v-for="(pair, index) in visiblePairs"
              :key="index"
              class="pairs__row row no-wrap items-center"
            >
              <input
                v-model="pair.word"
                class="col pairs__input"
                placeholder="people"
                aria-label="Word"
              />
              <q-icon name="sym_s_arrow_forward" size="16px" class="pairs__arrow" />
              <input
                v-model="pair.root"
                class="col pairs__input"
                placeholder="person"
                aria-label="Root"
              />
              <q-btn
                flat
                round
                dense
                size="xs"
                icon="sym_s_close"
                class="pairs__remove"
                aria-label="Remove pair"
                @click="removePair(pair)"
              />
            </div>
            <div v-if="state.pairs.length > visiblePairs.length" class="pairs__more ts-faint">
              Showing the first {{ visiblePairs.length }} of {{ state.pairs.length }} pairs. All of
              them are saved.
            </div>
            <div v-if="!state.pairs.length" class="pairs__more ts-faint">
              Add pairs one by one, or import a JSONL file with one {"word": "…", "root": "…"} per
              line.
            </div>
          </div>
          <div
            v-if="state.importMessage"
            class="text-caption q-mt-sm"
            :class="state.importError ? 'text-negative' : 'ts-muted'"
          >
            {{ state.importMessage }}
          </div>
        </div>
      </q-form>
      <template #actions>
        <q-btn v-close-popup flat no-caps label="Cancel" />
        <q-btn
          unelevated
          no-caps
          color="primary"
          type="submit"
          form="stemming-form"
          :label="state.editing ? 'Save dictionary' : 'Create dictionary'"
          :loading="state.saving"
        />
      </template>
    </side-sheet>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useQuasar } from 'quasar';
import type { QTableProps } from 'quasar';
import { useNodeStore } from '@/stores/node';
import { useCollectionsStore } from '@/stores/collections';
import { useStemmingStore } from '@/stores/stemming';
import PageHeader from '@/components/ui/PageHeader.vue';
import SideSheet from '@/components/ui/SideSheet.vue';
import EmptyState from '@/components/ui/EmptyState.vue';

interface Pair {
  word: string;
  root: string;
}

const $q = useQuasar();
const store = useNodeStore();
const collectionsStore = useCollectionsStore();
const stemmingStore = useStemmingStore();
const fileInput = ref<HTMLInputElement | null>(null);

/** Rendering thousands of inputs is slow; long dictionaries show a window. */
const MAX_VISIBLE = 300;

const state = reactive<{
  id: string;
  pairs: Pair[];
  original: Pair[];
  editing: boolean;
  sheetOpen: boolean;
  saving: boolean;
  importMessage: string;
  importError: boolean;
  filter: string;
}>({
  id: '',
  pairs: [],
  original: [],
  editing: false,
  sheetOpen: false,
  saving: false,
  importMessage: '',
  importError: false,
  filter: '',
});

const rows = computed(() =>
  stemmingStore.dictionaries.map((id) => ({
    id,
    usedBy: collectionsStore.collections.flatMap((c) =>
      (c.fields ?? []).filter((f) => f.stem_dictionary === id).map((f) => `${c.name}.${f.name}`),
    ),
  })),
);

const columns: QTableProps['columns'] = [
  { label: 'Dictionary', name: 'id', field: 'id', align: 'left', sortable: true },
  { label: 'Used by', name: 'usedBy', field: 'usedBy', align: 'left' },
  { label: '', name: 'actions', field: 'id', align: 'right' },
];

const visiblePairs = computed(() => state.pairs.slice(0, MAX_VISIBLE));

function cleanPairs(pairs: Pair[]) {
  return pairs
    .map((p) => ({ word: p.word.trim(), root: p.root.trim() }))
    .filter((p) => p.word && p.root);
}

function resetImport() {
  state.importMessage = '';
  state.importError = false;
}

function newDictionary() {
  state.id = '';
  state.pairs = [{ word: '', root: '' }];
  state.original = [];
  state.editing = false;
  resetImport();
  state.sheetOpen = true;
}

async function editDictionary(id: string) {
  const dictionary = (await stemmingStore.get(id)) as { words?: Pair[] } | undefined;
  state.id = id;
  state.pairs = (dictionary?.words ?? []).map((w) => ({ word: w.word, root: w.root }));
  state.original = cleanPairs(state.pairs);
  state.editing = true;
  resetImport();
  state.sheetOpen = true;
}

function addPair() {
  state.pairs.unshift({ word: '', root: '' });
}

function removePair(pair: Pair) {
  state.pairs.splice(state.pairs.indexOf(pair), 1);
}

/** Reads JSONL (or a JSON array) of {word, root} pairs in the browser. */
async function importFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  resetImport();
  const text = await file.text();
  try {
    const trimmed = text.trim();
    const items: unknown[] = trimmed.startsWith('[')
      ? JSON.parse(trimmed)
      : trimmed
          .split('\n')
          .filter((l) => l.trim())
          .map((l) => JSON.parse(l));
    const pairs = items
      .filter((i): i is Pair => !!i && typeof i === 'object' && 'word' in i && 'root' in i)
      .map((i) => ({ word: String(i.word), root: String(i.root) }));
    state.pairs = [...cleanPairs(state.pairs), ...pairs];
    state.importMessage = `Added ${pairs.length} pairs from ${file.name}.`;
  } catch (e) {
    state.importError = true;
    state.importMessage = `${file.name} isn't JSONL or a JSON array: ${(e as Error).message}`;
  }
}

async function upload(pairs: Pair[]) {
  await stemmingStore.upsert({ id: state.id, words: pairs });
  return !store.error;
}

async function saveDictionary() {
  const pairs = cleanPairs(state.pairs);
  if (!pairs.length) {
    state.importError = true;
    state.importMessage = 'Add at least one word pair.';
    return;
  }
  // Importing only ever adds pairs; removing one means rebuilding the dictionary.
  const key = (p: Pair) => `${p.word}\u0000${p.root}`;
  const kept = new Set(pairs.map(key));
  const removed = state.original.filter((p) => !kept.has(key(p)));

  const finish = async (rebuild: boolean) => {
    state.saving = true;
    if (rebuild) await stemmingStore.remove(state.id);
    const ok = await upload(pairs);
    state.saving = false;
    if (ok) {
      state.sheetOpen = false;
      $q.notify({
        type: 'positive',
        position: 'top',
        timeout: 1500,
        message: state.editing ? 'Dictionary saved' : 'Dictionary created',
      });
    }
  };

  if (removed.length) {
    $q.dialog({
      title: `Remove ${removed.length} ${removed.length === 1 ? 'pair' : 'pairs'}?`,
      message:
        'Typesense can only add pairs to a dictionary, so it will be deleted and created again with the pairs shown here. Searches may miss stemmed words for a moment.',
      cancel: { flat: true, noCaps: true, label: 'Cancel' },
      ok: { unelevated: true, noCaps: true, color: 'primary', label: 'Rebuild dictionary' },
    }).onOk(() => void finish(true));
    return;
  }
  await finish(false);
}

function deleteDictionary(id: string) {
  const usedBy = rows.value.find((r) => r.id === id)?.usedBy ?? [];
  $q.dialog({
    title: `Delete dictionary ${id}?`,
    message: usedBy.length
      ? `It's used by ${usedBy.join(', ')}. Those fields fall back to the default stemmer.`
      : "It isn't used by any field.",
    cancel: { flat: true, noCaps: true, label: 'Cancel' },
    ok: { unelevated: true, noCaps: true, color: 'negative', label: 'Delete dictionary' },
  }).onOk(() => {
    void stemmingStore.remove(id);
  });
}

onMounted(() => {
  void stemmingStore.load();
});
</script>

<style scoped lang="scss">
.pairs {
  border: 1px solid var(--ts-rule);
  border-radius: 10px;
  overflow: hidden;
  max-height: 52vh;
  overflow-y: auto;
}

.pairs__head {
  position: sticky;
  top: 0;
  gap: 8px;
  padding: 8px 10px;
  background: var(--ts-sheet-2);
  border-bottom: 1px solid var(--ts-rule);
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--ts-ink-3);
}

.pairs__row {
  gap: 8px;
  padding: 4px 6px 4px 10px;
  border-bottom: 1px solid var(--ts-rule);
  &:last-child {
    border-bottom: 0;
  }
}

.pairs__input {
  min-width: 0;
  border: 0;
  outline: 0;
  padding: 6px 4px;
  border-radius: 6px;
  background: transparent;
  color: var(--ts-ink);
  font-family: var(--ts-font-mono);
  font-size: 0.85rem;
  &:focus {
    background: var(--ts-primary-soft);
  }
}

.pairs__arrow {
  width: 16px;
  color: var(--ts-ink-3);
}

.pairs__remove {
  width: 24px;
  color: var(--ts-ink-3);
}

.pairs__more {
  padding: 10px;
  font-size: 0.8rem;
}
</style>
