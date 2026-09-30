<template>
  <q-page class="ts-page">
    <page-header
      v-if="setsMode"
      title="Synonyms"
      description="Synonyms let a search for one word find documents that use another. They live in sets; a collection uses the sets you link to it."
    />

    <rule-set-browser
      v-if="setsMode"
      v-model:selected="selectedSet"
      kind="synonym"
      :rule-sets="ruleSets"
      item-noun="synonym"
      empty-icon="sym_s_join"
      empty-title="Create your first synonym set"
      empty-body="Group related synonyms in a set, such as product terms, then link it to the collections that should use them."
    >
      <template #default="{ set }">
        <synonym-table
          :rows="set.items as SynonymItem[]"
          @create="openEditor()"
          @edit="openEditor($event)"
          @delete="removeItem"
        />
      </template>
    </rule-set-browser>

    <template v-else-if="collectionName">
      <synonym-table
        :rows="store.data.synonyms as SynonymItem[]"
        @create="openEditor()"
        @edit="openEditor($event)"
        @delete="removeItem"
      />
    </template>

    <div v-else class="ts-sheet">
      <empty-state
        icon="sym_s_join"
        title="Synonyms belong to a collection on this server"
        body="Open a collection and choose its Synonyms tab. Synonym sets shared between collections need Typesense 30 or later."
      >
        <q-btn unelevated no-caps color="primary" label="Go to collections" to="/collections" />
      </empty-state>
    </div>

    <side-sheet
      v-model="editor.open"
      :title="editor.isNew ? 'New synonym' : 'Edit synonym'"
      :description="setsMode ? `In set ${selectedSet}` : `In collection ${collectionName}`"
    >
      <q-form id="synonym-form" class="column q-gutter-md" @submit="saveItem">
        <div>
          <div class="ts-eyebrow q-mb-sm">How should the words match?</div>
          <div class="kinds">
            <button
              type="button"
              class="kind"
              :class="{ 'is-selected': !editor.oneWay }"
              @click="editor.oneWay = false"
            >
              <span class="kind__example">tv = television</span>
              <span class="kind__label">Same meaning, both ways</span>
            </button>
            <button
              type="button"
              class="kind"
              :class="{ 'is-selected': editor.oneWay }"
              @click="editor.oneWay = true"
            >
              <span class="kind__example">shoes → sneakers</span>
              <span class="kind__label">One word also finds others</span>
            </button>
          </div>
        </div>
        <q-input
          v-if="editor.oneWay"
          v-model="editor.item.root"
          outlined
          label="When someone searches for"
          placeholder="shoes"
          lazy-rules
          :rules="[(v) => !!v || 'Enter the search word']"
        />
        <q-select
          v-model="editor.item.synonyms"
          outlined
          multiple
          use-chips
          use-input
          new-value-mode="add-unique"
          hide-dropdown-icon
          input-debounce="0"
          :label="editor.oneWay ? 'Also find' : 'Words that mean the same'"
          hint="Type a word or phrase and press Enter."
          lazy-rules
          :rules="[
            (v) =>
              (v && v.length >= (editor.oneWay ? 1 : 2)) ||
              (editor.oneWay ? 'Add at least one word' : 'Add at least two words'),
          ]"
        />
        <q-expansion-item
          dense
          switch-toggle-side
          header-class="q-px-none ts-muted"
          label="More options"
        >
          <div class="column q-gutter-md q-pt-sm">
            <q-input
              v-model="editor.item.id"
              outlined
              label="ID"
              :readonly="!editor.isNew"
              hint="Created from the words if left empty."
            />
            <q-input
              v-model="editor.item.locale"
              outlined
              label="Locale"
              placeholder="en"
              hint="Leave empty to detect it."
            />
            <q-select
              v-model="editor.item.symbols_to_index"
              outlined
              multiple
              use-chips
              use-input
              new-value-mode="add-unique"
              hide-dropdown-icon
              input-debounce="0"
              label="Symbols to keep"
              hint="Characters such as + or # that are part of the words, as in c++."
            />
          </div>
        </q-expansion-item>
      </q-form>
      <template #actions>
        <q-btn v-close-popup flat no-caps label="Cancel" />
        <q-btn
          unelevated
          no-caps
          color="primary"
          type="submit"
          form="synonym-form"
          :label="editor.isNew ? 'Add synonym' : 'Save synonym'"
        />
      </template>
    </side-sheet>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useQuasar } from 'quasar';
import { nanoid } from 'nanoid';
import { useNodeStore } from '@/stores/node';
import { useRuleSets } from '@/shared/useRuleSets';
import PageHeader from '@/components/ui/PageHeader.vue';
import SideSheet from '@/components/ui/SideSheet.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import RuleSetBrowser from '@/components/rules/RuleSetBrowser.vue';
import SynonymTable from '@/components/rules/SynonymTable.vue';
import type { SynonymItem } from '@/components/rules/SynonymTable.vue';

const $q = useQuasar();
const store = useNodeStore();
const route = useRoute();
const ruleSets = useRuleSets('synonym');

const setsMode = computed(() => store.data.features.synonymSets);
const collectionName = computed(() => (route.params.name as string | undefined) ?? '');
const selectedSet = ref<string | null>(null);

const editor = reactive<{ open: boolean; isNew: boolean; oneWay: boolean; item: SynonymItem }>({
  open: false,
  isNew: true,
  oneWay: false,
  item: { id: '', synonyms: [] },
});

function slug(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);
}

function openEditor(item?: SynonymItem) {
  editor.isNew = !item;
  editor.item = item
    ? JSON.parse(JSON.stringify(item))
    : { id: '', synonyms: [], root: '', locale: '', symbols_to_index: [] };
  editor.oneWay = !!item?.root;
  editor.open = true;
}

function buildItem(): SynonymItem {
  const { id, synonyms, root, locale, symbols_to_index } = editor.item;
  const item: SynonymItem = {
    id: id?.trim() || `${slug(root || synonyms[0] || 'synonym')}-${nanoid(5).toLowerCase()}`,
    synonyms: [...synonyms],
  };
  if (editor.oneWay && root) item.root = root.trim();
  if (locale) item.locale = locale;
  if (symbols_to_index?.length) item.symbols_to_index = [...symbols_to_index];
  return item;
}

async function saveItem() {
  const item = buildItem();
  let ok: boolean;
  if (setsMode.value) {
    if (!selectedSet.value) return;
    ok = await ruleSets.saveItem(selectedSet.value, item);
  } else {
    const { id, ...synonym } = item;
    await store.createSynonym({ id, synonym });
    ok = !store.error;
  }
  if (ok) {
    editor.open = false;
    $q.notify({
      type: 'positive',
      position: 'top',
      timeout: 1500,
      message: editor.isNew ? 'Synonym added' : 'Synonym saved',
    });
  }
}

function removeItem(item: SynonymItem) {
  const words = item.root
    ? `${item.root} → ${item.synonyms.join(', ')}`
    : item.synonyms.join(' = ');
  $q.dialog({
    title: 'Delete this synonym?',
    message: words,
    cancel: { flat: true, noCaps: true, label: 'Cancel' },
    ok: { unelevated: true, noCaps: true, color: 'negative', label: 'Delete synonym' },
  }).onOk(() => {
    if (setsMode.value && selectedSet.value) void ruleSets.deleteItem(selectedSet.value, item.id);
    else void store.deleteSynonym({ id: item.id });
  });
}

function refresh() {
  if (setsMode.value) void ruleSets.load();
  else if (collectionName.value) store.getSynonyms(collectionName.value);
}

onMounted(refresh);
watch([setsMode, collectionName], refresh);
</script>

<style scoped lang="scss">
.kinds {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.kind {
  display: grid;
  gap: 4px;
  padding: 12px;
  text-align: left;
  font: inherit;
  color: var(--ts-ink);
  background: var(--ts-sheet);
  border: 1px solid var(--ts-rule);
  border-radius: 10px;
  cursor: pointer;
  &:hover {
    border-color: var(--ts-rule-strong);
  }
  &.is-selected {
    border-color: var(--ts-primary);
    box-shadow: 0 0 0 1px var(--ts-primary);
  }
}

.kind__example {
  font-family: var(--ts-font-mono);
  font-size: 0.85rem;
}

.kind__label {
  font-size: 0.78rem;
  color: var(--ts-ink-3);
}
</style>
