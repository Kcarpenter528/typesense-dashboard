<template>
  <q-page class="ts-page">
    <page-header
      v-if="setsMode"
      title="Curations"
      description="Curations change the results for specific searches: pin documents to fixed positions, hide others, or apply filters and sorting. They live in sets that collections opt into."
    />

    <rule-set-browser
      v-if="setsMode"
      v-model:selected="selectedSet"
      kind="curation"
      :rule-sets="ruleSets"
      item-noun="curation"
      empty-icon="sym_s_push_pin"
      empty-title="Create your first curation set"
      empty-body="Group curations, such as merchandising for a campaign, then link the set to the collections it applies to."
    >
      <template #default="{ set }">
        <curation-table
          :rows="set.items as CurationItem[]"
          @create="openEditor()"
          @edit="openEditor($event)"
          @delete="removeItem"
        />
      </template>
    </rule-set-browser>

    <template v-else-if="collectionName">
      <curation-table
        :rows="store.data.overrides as CurationItem[]"
        @create="openEditor()"
        @edit="openEditor($event)"
        @delete="removeItem"
      />
    </template>

    <div v-else class="ts-sheet">
      <empty-state
        icon="sym_s_push_pin"
        title="Curations belong to a collection on this server"
        body="Open a collection and choose its Curations tab. Curation sets shared between collections need Typesense 30 or later."
      >
        <q-btn unelevated no-caps color="primary" label="Go to collections" to="/collections" />
      </empty-state>
    </div>

    <side-sheet
      v-model="editor.open"
      :title="editor.isNew ? 'New curation' : 'Edit curation'"
      :description="setsMode ? `In set ${selectedSet}` : `In collection ${collectionName}`"
      width="min(640px, 100vw)"
    >
      <q-form id="curation-form" class="column q-gutter-lg" @submit="saveItem">
        <section>
          <div class="section-title">When</div>
          <div class="row q-col-gutter-sm">
            <q-input
              v-model="rule.query"
              class="col-12 col-sm-8"
              outlined
              label="Search is"
              placeholder="urgent"
            />
            <q-select
              v-model="rule.match"
              class="col-12 col-sm-4"
              outlined
              label="Match"
              :options="[
                { label: 'Exactly', value: 'exact' },
                { label: 'Contains', value: 'contains' },
              ]"
              emit-value
              map-options
            />
          </div>
          <q-input
            v-model="rule.filter_by"
            class="q-mt-sm"
            outlined
            label="Or the search's filter matches"
            placeholder="category:shoes"
            hint="Optional. Use a query, a filter, or both."
          />
          <q-select
            v-if="store.supportsCurationRuleTags"
            v-model="rule.tags"
            class="q-mt-sm"
            outlined
            multiple
            use-chips
            use-input
            new-value-mode="add-unique"
            hide-dropdown-icon
            input-debounce="0"
            label="Or the search sends one of these tags"
            hint="Sent with the curation_tags search parameter."
          />
          <div v-if="editor.whenError" class="text-negative text-caption q-mt-xs">
            {{ editor.whenError }}
          </div>
        </section>

        <section>
          <div class="row items-center justify-between">
            <div class="section-title">Pin documents</div>
            <q-btn flat dense no-caps size="sm" icon="sym_s_add" label="Add pin" @click="addPin" />
          </div>
          <div v-if="!editor.item.includes?.length" class="ts-faint text-caption">
            No pinned documents.
          </div>
          <div
            v-for="(pin, index) in editor.item.includes"
            :key="index"
            class="row no-wrap items-center q-gutter-x-sm q-mb-sm"
          >
            <q-input
              v-model="pin.id"
              class="col"
              dense
              outlined
              label="Document ID"
              input-class="text-mono"
            />
            <q-input
              v-model.number="pin.position"
              style="width: 110px"
              dense
              outlined
              type="number"
              min="1"
              label="Position"
            />
            <q-btn
              flat
              round
              dense
              icon="sym_s_close"
              aria-label="Remove pin"
              @click="editor.item.includes!.splice(index, 1)"
            />
          </div>
        </section>

        <section>
          <div class="section-title">Hide documents</div>
          <q-select
            v-model="excludeIds"
            outlined
            multiple
            use-chips
            use-input
            new-value-mode="add-unique"
            hide-dropdown-icon
            input-debounce="0"
            label="Document IDs"
            hint="Type an ID and press Enter."
          />
        </section>

        <q-expansion-item
          dense
          switch-toggle-side
          header-class="q-px-none ts-muted"
          label="More options"
        >
          <div class="column q-gutter-md q-pt-sm">
            <q-input
              v-model="editor.item.filter_by"
              outlined
              label="Apply filter"
              placeholder="in_stock:true"
            />
            <q-input
              v-model="editor.item.sort_by"
              outlined
              label="Sort results by"
              placeholder="price:asc"
            />
            <q-input v-model="editor.item.replace_query" outlined label="Replace the search with" />
            <div class="row q-col-gutter-sm">
              <q-input
                v-model="activeFrom"
                class="col-6"
                outlined
                type="date"
                stack-label
                clearable
                label="Active from"
              />
              <q-input
                v-model="activeTo"
                class="col-6"
                outlined
                type="date"
                stack-label
                clearable
                label="Active until"
              />
            </div>
            <q-toggle
              :model-value="editor.item.remove_matched_tokens !== false"
              label="Remove the matched words from the search"
              @update:model-value="editor.item.remove_matched_tokens = $event"
            />
            <q-toggle
              v-model="editor.item.filter_curated_hits"
              label="Apply search filters to pinned documents too"
            />
            <q-toggle
              :model-value="editor.item.stop_processing !== false"
              label="Stop at this curation when it matches"
              @update:model-value="editor.item.stop_processing = $event"
            />
            <q-input
              v-model="editor.item.id"
              outlined
              label="ID"
              :readonly="!editor.isNew"
              hint="Created automatically if left empty."
            />
            <div>
              <div class="ts-eyebrow q-mb-xs">Edit as JSON</div>
              <div class="json-editor">
                <monaco-editor v-model="itemJson" />
              </div>
              <div v-if="editor.jsonError" class="text-negative text-caption q-mt-xs">
                {{ editor.jsonError }}
              </div>
            </div>
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
          form="curation-form"
          :label="editor.isNew ? 'Add curation' : 'Save curation'"
          :disable="!!editor.jsonError"
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
import MonacoEditor from '@/components/MonacoEditor.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import SideSheet from '@/components/ui/SideSheet.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import RuleSetBrowser from '@/components/rules/RuleSetBrowser.vue';
import CurationTable from '@/components/rules/CurationTable.vue';
import type { CurationItem } from '@/components/rules/CurationTable.vue';

const $q = useQuasar();
const store = useNodeStore();
const route = useRoute();
const ruleSets = useRuleSets('curation');

const setsMode = computed(() => store.data.features.curationSets);
const collectionName = computed(() => (route.params.name as string | undefined) ?? '');
const selectedSet = ref<string | null>(null);

const editor = reactive<{
  open: boolean;
  isNew: boolean;
  item: CurationItem;
  jsonError: string | null;
  whenError: string | null;
}>({
  open: false,
  isNew: true,
  item: emptyItem(),
  jsonError: null,
  whenError: null,
});

function emptyItem(): CurationItem {
  return { id: '', rule: { query: '', match: 'exact' }, includes: [], excludes: [] };
}

const rule = computed(() => editor.item.rule);

const excludeIds = computed({
  get: () => (editor.item.excludes ?? []).map((e) => e.id),
  set: (ids: string[]) => (editor.item.excludes = ids.map((id) => ({ id }))),
});

function dateInput(ts?: number) {
  return ts ? new Date(ts * 1000).toISOString().slice(0, 10) : null;
}

function toTimestamp(date: string | null, endOfDay: boolean) {
  if (!date) return undefined;
  return Math.floor(new Date(`${date}T${endOfDay ? '23:59:59' : '00:00:00'}`).getTime() / 1000);
}

const activeFrom = computed({
  get: () => dateInput(editor.item.effective_from_ts),
  set: (value: string | null) => setTimestamp('effective_from_ts', toTimestamp(value, false)),
});
const activeTo = computed({
  get: () => dateInput(editor.item.effective_to_ts),
  set: (value: string | null) => setTimestamp('effective_to_ts', toTimestamp(value, true)),
});

function setTimestamp(key: 'effective_from_ts' | 'effective_to_ts', value: number | undefined) {
  if (value === undefined) delete editor.item[key];
  else editor.item[key] = value;
}

const itemJson = computed({
  get: () => JSON.stringify(editor.item, null, 2),
  set: (json: string) => {
    try {
      const parsed = JSON.parse(json) as CurationItem;
      editor.item = { ...parsed, rule: parsed.rule ?? {} };
      editor.jsonError = null;
    } catch (e) {
      editor.jsonError = `This isn't valid JSON yet: ${(e as Error).message}`;
    }
  },
});

function openEditor(item?: CurationItem) {
  editor.isNew = !item;
  editor.item = item ? JSON.parse(JSON.stringify({ ...item, _setName: undefined })) : emptyItem();
  editor.item.rule = editor.item.rule ?? {};
  editor.item.includes = editor.item.includes ?? [];
  editor.item.excludes = editor.item.excludes ?? [];
  editor.jsonError = null;
  editor.whenError = null;
  editor.open = true;
}

function addPin() {
  const next = (editor.item.includes?.length ?? 0) + 1;
  editor.item.includes = [...(editor.item.includes ?? []), { id: '', position: next }];
}

/** Drops empty fields so the server gets only what was filled in. */
function buildItem(): CurationItem {
  const source = editor.item;
  const ruleOut: CurationItem['rule'] = {};
  if (source.rule.query?.trim()) {
    ruleOut.query = source.rule.query.trim();
    ruleOut.match = source.rule.match ?? 'exact';
  }
  if (source.rule.filter_by?.trim()) ruleOut.filter_by = source.rule.filter_by.trim();
  if (source.rule.tags?.length) ruleOut.tags = [...source.rule.tags];

  const item: CurationItem = {
    ...JSON.parse(JSON.stringify(source)),
    id: source.id?.trim() || `curation-${nanoid(6).toLowerCase()}`,
    rule: ruleOut,
  };
  item.includes = (source.includes ?? [])
    .filter((p) => p.id.trim())
    .map((p) => ({ id: p.id.trim(), position: Number(p.position) || 1 }));
  item.excludes = (source.excludes ?? []).filter((e) => e.id.trim());
  for (const key of ['filter_by', 'sort_by', 'replace_query'] as const) {
    if (!item[key]) delete item[key];
  }
  delete item._setName;
  return item;
}

async function saveItem() {
  const item = buildItem();
  if (!item.rule.query && !item.rule.filter_by && !item.rule.tags?.length) {
    editor.whenError = 'Enter a search, a filter or a tag that triggers this curation.';
    return;
  }
  editor.whenError = null;
  let ok: boolean;
  if (setsMode.value) {
    if (!selectedSet.value) return;
    ok = await ruleSets.saveItem(selectedSet.value, item);
  } else {
    const { id, ...override } = item;
    await store.createOverride({ id, override: override });
    ok = !store.error;
  }
  if (ok) {
    editor.open = false;
    $q.notify({
      type: 'positive',
      position: 'top',
      timeout: 1500,
      message: editor.isNew ? 'Curation added' : 'Curation saved',
    });
  }
}

function removeItem(item: CurationItem) {
  $q.dialog({
    title: 'Delete this curation?',
    message: item.rule?.query ? `Searches for “${item.rule.query}” go back to normal results.` : '',
    cancel: { flat: true, noCaps: true, label: 'Cancel' },
    ok: { unelevated: true, noCaps: true, color: 'negative', label: 'Delete curation' },
  }).onOk(() => {
    if (setsMode.value && selectedSet.value) void ruleSets.deleteItem(selectedSet.value, item.id);
    else void store.deleteOverride({ id: item.id });
  });
}

function refresh() {
  if (setsMode.value) void ruleSets.load();
  else if (collectionName.value) store.getOverrides(collectionName.value);
}

onMounted(refresh);
watch([setsMode, collectionName], refresh);
</script>

<style scoped lang="scss">
.section-title {
  font-weight: 600;
  font-size: 0.9rem;
  margin-bottom: 8px;
}

.json-editor {
  height: 240px;
  display: flex;
  border: 1px solid var(--ts-rule);
  border-radius: 8px;
  overflow: hidden;
}
</style>
