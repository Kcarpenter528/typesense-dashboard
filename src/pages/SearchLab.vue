<template>
  <q-page class="ts-page">
    <page-header
      help="searchLab"
      title="Search lab"
      description="Search several collections at once and tune each one: which fields count most, how forgiving typos are, filters and sorting. When the results look right, copy the request as code or save it as a preset."
    >
      <q-btn-dropdown
        v-if="store.data.features.searchPresets"
        flat
        no-caps
        icon="sym_s_bookmark"
        label="Load preset"
        :disable="!presetsStore.presets.length"
      >
        <q-list dense style="min-width: 200px">
          <q-item
            v-for="p in presetsStore.presets"
            :key="p.name"
            v-close-popup
            clickable
            @click="loadPreset(p)"
          >
            <q-item-section class="text-mono">{{ p.name }}</q-item-section>
          </q-item>
        </q-list>
      </q-btn-dropdown>
      <q-btn
        flat
        no-caps
        icon="sym_s_content_paste"
        label="Paste request"
        @click="pasteOpen = true"
      />
      <q-btn
        v-if="store.data.features.searchPresets"
        flat
        no-caps
        icon="sym_s_bookmark_add"
        label="Save as preset"
        :disable="!!problems.length"
        @click="savePreset"
      />
      <q-btn
        unelevated
        no-caps
        color="primary"
        icon="sym_s_code"
        label="Get code"
        :disable="!config.searches.length"
        @click="codeOpen = true"
      />
    </page-header>

    <section class="ts-sheet bar">
      <q-input
        v-model="config.q"
        outlined
        dense
        autofocus
        class="bar__query"
        placeholder="Type a query. Empty searches every document."
        aria-label="Query"
        @keydown.enter="run()"
      >
        <template #prepend><q-icon name="sym_s_search" /></template>
        <template #append>
          <q-btn
            v-if="config.q"
            flat
            round
            dense
            size="sm"
            icon="sym_s_close"
            aria-label="Clear query"
            @click="config.q = ''"
          />
        </template>
      </q-input>
      <q-btn
        unelevated
        no-caps
        color="primary"
        icon="sym_s_play_arrow"
        label="Search"
        :loading="running"
        :disable="!!problems.length"
        @click="run()"
      />
      <q-toggle v-model="autoRun" label="Search as I change settings" dense />
      <span v-if="roundTripMs !== null" class="bar__time ts-muted">
        {{ roundTripMs }} ms round trip
      </span>
    </section>

    <div v-if="runError" class="banner banner--error">{{ runError }}</div>
    <ul v-else-if="problems.length && config.searches.length" class="banner banner--warn">
      <li v-for="p in problems" :key="p">{{ p }}</li>
    </ul>

    <section class="tools">
      <q-expansion-item
        dense
        class="ts-sheet tools__common"
        header-class="tools__header"
        label="Settings for every collection"
        caption="Applied unless a collection sets its own"
      >
        <div class="tools__body">
          <div class="ts-eyebrow q-mb-sm row items-center">
            Shared <help-tip topic="lab.common" class="q-ml-xs" />
          </div>
          <search-lab-params v-model="config.common" />
        </div>
      </q-expansion-item>

      <div class="ts-sheet tools__baseline">
        <div class="row items-center no-wrap">
          <span class="ts-eyebrow">Baseline</span>
          <help-tip topic="lab.baseline" class="q-ml-xs" />
        </div>
        <template v-if="!baseline">
          <p class="tools__hint">Pin these results, then change a setting to see what moved.</p>
          <q-btn
            outline
            no-caps
            size="sm"
            icon="sym_s_push_pin"
            label="Pin current results"
            :disable="!hasResults"
            @click="pinBaseline()"
          />
        </template>
        <template v-else>
          <p v-if="baselineSummary" class="tools__hint">
            <strong>{{ baselineSummary.up }}</strong> up ·
            <strong>{{ baselineSummary.down }}</strong> down ·
            <strong>{{ baselineSummary.added }}</strong> new ·
            <strong>{{ baselineSummary.removed }}</strong> dropped
          </p>
          <div class="row q-gutter-x-xs">
            <q-btn
              flat
              no-caps
              size="sm"
              icon="sym_s_push_pin"
              label="Re-pin"
              @click="pinBaseline()"
            />
            <q-btn
              flat
              no-caps
              size="sm"
              icon="sym_s_undo"
              label="Restore its settings"
              @click="restoreBaseline()"
            />
            <q-btn
              flat
              no-caps
              size="sm"
              icon="sym_s_close"
              label="Clear"
              @click="clearBaseline()"
            />
          </div>
        </template>
      </div>
    </section>

    <div class="adder">
      <q-select
        dense
        outlined
        options-dense
        class="adder__select text-mono"
        label="Add a collection to search"
        :model-value="null"
        :options="collectionNames"
        :disable="!collectionNames.length"
        @update:model-value="addSearch($event as string)"
      />
      <q-btn
        v-if="collectionNames.length > 1"
        flat
        no-caps
        size="sm"
        icon="sym_s_library_add"
        label="Add all"
        @click="addAll"
      />
    </div>

    <div v-if="config.searches.length" class="cards">
      <search-lab-card
        v-for="(s, i) in config.searches"
        :key="s.id"
        :search="s"
        :result="results[s.id]"
        :baseline="baseline?.results[s.id]"
        :collections="collectionNames"
        :fields="fieldsOf(s.collection)"
        :common="config.common"
        :running="running"
        @update:search="updateSearch(i, $event)"
        @change-collection="changeCollection(i, $event)"
        @duplicate="copySearch(i)"
        @remove="removeSearch(i)"
        @expect="addExpected"
      />
    </div>
    <section v-else class="ts-sheet">
      <empty-state
        icon="sym_s_science"
        title="Pick the collections to search"
        body="Add one or more collections. They are searched together in a single request, the way a search box over several kinds of content would."
      >
        <q-btn
          v-if="collectionNames.length"
          unelevated
          no-caps
          color="primary"
          :label="collectionNames.length > 1 ? 'Add all collections' : 'Add the collection'"
          @click="addAll"
        />
        <div v-else class="ts-faint">This server has no collections yet.</div>
      </empty-state>
    </section>

    <search-lab-tests
      :tests="tests"
      :outcomes="outcomes"
      :collections="collectionNames"
      :running="testsRunning"
      :disabled="!!problems.length"
      :summary="testSummary"
      @update:tests="tests = $event"
      @add="addTest()"
      @remove="removeTest"
      @run="runTests()"
    />

    <side-sheet
      v-model="codeOpen"
      title="Request"
      description="Exactly what the dashboard sends. Paste it into your app, or into a search box you are tuning elsewhere."
      width="min(720px, 100vw)"
    >
      <search-lab-request v-if="nodeInfo" :request="request" :node="nodeInfo" />
    </side-sheet>

    <side-sheet
      v-model="pasteOpen"
      title="Paste a request"
      description="Paste a multi_search body ({ &quot;searches&quot;: [...] }), one search's parameters, or a preset's value. It replaces the collections below."
      width="min(620px, 100vw)"
    >
      <q-input
        v-model="pasteText"
        outlined
        autogrow
        type="textarea"
        class="text-mono"
        placeholder='{ "searches": [{ "collection": "products", "query_by": "title,brand", "q": "shoes" }] }'
        :error="!!pasteError"
        :error-message="pasteError"
      />
      <template #actions>
        <q-btn v-close-popup flat no-caps label="Cancel" />
        <q-btn
          unelevated
          no-caps
          color="primary"
          label="Use this request"
          :disable="!pasteText.trim()"
          @click="applyPaste"
        />
      </template>
    </side-sheet>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useQuasar } from 'quasar';
import type { PresetSchema } from 'typesense/lib/Typesense/Preset';
import { useNodeStore } from '@/stores/node';
import { useCollectionsStore } from '@/stores/collections';
import { useSearchPresetsStore } from '@/stores/searchPresets';
import { useSearchLab } from '@/shared/useSearchLab';
import { searchesFromJson, toPresetValue } from '@/shared/searchLab';
import type { LabHit, NodeInfo } from '@/shared/searchLab';
import HelpTip from '@/components/help/HelpTip.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import SideSheet from '@/components/ui/SideSheet.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import SearchLabCard from '@/components/search/lab/SearchLabCard.vue';
import SearchLabParams from '@/components/search/lab/SearchLabParams.vue';
import SearchLabRequest from '@/components/search/lab/SearchLabRequest.vue';
import SearchLabTests from '@/components/search/lab/SearchLabTests.vue';

const $q = useQuasar();
const store = useNodeStore();
const collectionsStore = useCollectionsStore();
const presetsStore = useSearchPresetsStore();

const {
  config,
  tests,
  autoRun,
  results,
  running,
  runError,
  roundTripMs,
  baseline,
  baselineSummary,
  outcomes,
  testsRunning,
  testSummary,
  request,
  problems,
  collectionNames,
  fieldsOf,
  run,
  addSearch,
  updateSearch,
  changeCollection,
  removeSearch,
  copySearch,
  replaceSearches,
  pinBaseline,
  clearBaseline,
  restoreBaseline,
  addTest,
  removeTest,
  runTests,
} = useSearchLab();

const codeOpen = ref(false);
const pasteOpen = ref(false);
const pasteText = ref('');
const pasteError = ref('');

const hasResults = computed(() => Object.keys(results.value).length > 0);

const nodeInfo = computed<NodeInfo | null>(() => {
  const n = store.loginData?.node;
  return n
    ? { protocol: n.protocol, host: n.host, port: n.port, ...(n.path ? { path: n.path } : {}) }
    : null;
});

function addAll() {
  for (const name of collectionNames.value) {
    if (!config.searches.some((s) => s.collection === name)) addSearch(name);
  }
}

function addExpected(hit: LabHit) {
  addTest({ q: config.q, collection: hit.collection, expect: [hit.id], top: 3 });
  $q.notify({
    message: `Test added below: document ${hit.id} should rank in the top 3`,
    position: 'top',
    timeout: 2200,
  });
}

/** A pasted request may carry the query text; take it from the body or the first search. */
function queryFrom(json: string): string | undefined {
  try {
    const parsed = JSON.parse(json) as { q?: unknown; searches?: { q?: unknown }[] };
    const q = parsed.q ?? parsed.searches?.find((s) => typeof s?.q === 'string')?.q;
    return typeof q === 'string' ? q : undefined;
  } catch {
    return undefined;
  }
}

function applyPaste() {
  try {
    const searches = searchesFromJson(pasteText.value, collectionNames.value[0] ?? '');
    if (!searches.length) throw new Error('That request has no searches in it.');
    replaceSearches(searches);
    const q = queryFrom(pasteText.value);
    if (q !== undefined && q !== '*') config.q = q;
    pasteOpen.value = false;
    pasteText.value = '';
    pasteError.value = '';
  } catch (error) {
    pasteError.value = (error as Error).message;
  }
}

function loadPreset(preset: PresetSchema<Record<string, unknown>>) {
  try {
    replaceSearches(searchesFromJson(JSON.stringify(preset.value), collectionNames.value[0] ?? ''));
    $q.notify({ message: `Loaded preset ${preset.name}`, position: 'top', timeout: 1500 });
  } catch (error) {
    $q.notify({ type: 'negative', message: (error as Error).message });
  }
}

function savePreset() {
  $q.dialog({
    title: 'Save as search preset',
    message:
      config.searches.length > 1
        ? 'Stores these collections and settings as one multi-search preset. Name it, then search with preset=<name>.'
        : 'Stores these settings as a preset. Name it, then search with preset=<name>.',
    prompt: {
      model: '',
      type: 'text',
      isValid: (v: string) => /^[\w-]+$/.test(v),
      hint: 'Letters, numbers, - and _',
    },
    cancel: { flat: true, noCaps: true, label: 'Cancel' },
    ok: { unelevated: true, noCaps: true, color: 'primary', label: 'Save preset' },
  }).onOk((name: string) => {
    const save = async () => {
      await presetsStore.upsert({ name, value: toPresetValue(config) });
      if (!store.error) {
        $q.notify({
          type: 'positive',
          message: `Saved preset ${name}`,
          position: 'top',
          timeout: 1800,
        });
      }
    };
    if (presetsStore.presets.some((p) => p.name === name)) {
      $q.dialog({
        title: `Replace preset ${name}?`,
        message: 'A preset with this name exists. Saving overwrites it.',
        cancel: { flat: true, noCaps: true, label: 'Cancel' },
        ok: { unelevated: true, noCaps: true, color: 'negative', label: 'Replace' },
      }).onOk(() => void save());
    } else {
      void save();
    }
  });
}

onMounted(async () => {
  if (!collectionsStore.collections.length) await collectionsStore.getCollections();
  if (store.data.features.searchPresets) void presetsStore.load();
  if (config.searches.length && !problems.value.length) void run();
});
</script>

<style scoped lang="scss">
.bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
  padding: 12px 14px;
}

.bar__query {
  flex: 1 1 320px;
  min-width: 0;
}

.bar__time {
  font-size: 0.8rem;
}

.banner {
  margin: 12px 0 0;
  padding: 10px 14px 10px 16px;
  border-radius: 10px;
  font-size: 0.85rem;
  overflow-wrap: anywhere;
}

ul.banner {
  padding-left: 32px;
}

.banner--error {
  background: var(--ts-danger-soft);
  border: 1px solid rgba(200, 50, 75, 0.3);
}

.banner--warn {
  background: var(--ts-warning-soft);
}

.tools {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(240px, 1fr);
  gap: 12px;
  margin-top: 12px;
  align-items: start;
  @media (max-width: 899px) {
    grid-template-columns: minmax(0, 1fr);
  }
}

.tools__body {
  padding: 4px 16px 16px;
}

.tools__baseline {
  padding: 12px 16px;
}

.tools__hint {
  margin: 6px 0 8px;
  font-size: 0.82rem;
  color: var(--ts-ink-2);
  strong {
    color: var(--ts-ink);
  }
}

:deep(.tools__header) {
  font-size: 0.9rem;
}

.adder {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 20px 0 12px;
}

.adder__select {
  width: min(320px, 100%);
}

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 440px), 1fr));
  gap: 16px;
  align-items: start;
}
</style>
