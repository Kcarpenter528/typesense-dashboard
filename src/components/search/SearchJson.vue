<template>
  <div class="json-search">
    <section class="ts-sheet editor-card">
      <div class="editor-card__bar row items-center justify-between">
        <span class="ts-eyebrow">Search parameters</span>
        <div class="row items-center q-gutter-x-xs">
          <q-btn
            flat
            dense
            no-caps
            size="sm"
            label="Reset to this collection"
            @click="resetParameters"
          />
          <q-btn
            unelevated
            no-caps
            color="primary"
            icon="sym_s_play_arrow"
            label="Run search"
            :disable="!!jsonError"
            @click="search()"
          >
            <q-tooltip>Ctrl + Enter</q-tooltip>
          </q-btn>
        </div>
      </div>
      <div
        class="editor"
        @keydown.ctrl.enter.prevent="search()"
        @keydown.meta.enter.prevent="search()"
      >
        <monaco-editor v-model="searchParametersJson" />
      </div>
      <div v-if="jsonError" class="json-error">{{ jsonError }}</div>
    </section>

    <aside class="ts-sheet history">
      <div class="ts-eyebrow history__title">Recent searches</div>
      <div v-if="!history.length" class="ts-faint text-caption q-pa-sm">
        Searches you run appear here.
      </div>
      <button
        v-for="h in history"
        :key="h"
        type="button"
        class="history__item text-mono"
        :title="h"
        @click="searchParametersJson = h"
      >
        {{ summarize(h) }}
      </button>
    </aside>
  </div>

  <div v-if="results" class="results-bar row items-center justify-between q-mt-md q-gutter-y-xs">
    <span class="ts-muted">
      <template v-if="results.hits">
        <strong>{{ (results.found ?? 0).toLocaleString() }}</strong> found ·
        {{ results.search_time_ms }} ms
      </template>
      <template v-else>Raw response</template>
    </span>
    <div class="row q-gutter-x-xs">
      <q-btn
        flat
        dense
        no-caps
        size="sm"
        icon="sym_s_download"
        label="Export hits"
        :disable="!results.hits"
        @click="exportHits()"
      />
      <q-btn
        flat
        dense
        no-caps
        size="sm"
        icon="sym_s_data_object"
        label="Export full response"
        @click="exportResults()"
      />
    </div>
  </div>
  <div v-if="hits.length" class="ais-Hits q-mt-sm">
    <ol class="ais-Hits-list">
      <li v-for="item in hits" :key="item.id" class="ais-Hits-item">
        <search-result-item :item="item" />
      </li>
    </ol>
  </div>
  <div v-if="results && results.hits && results.hits.length === 0" class="ts-sheet q-mt-sm">
    <empty-state
      icon="sym_s_search_off"
      title="No documents match"
      body="Try a broader q, or remove a filter_by condition."
    />
  </div>
  <pre v-if="results && !results.hits" class="ts-sheet raw q-mt-sm">{{ resultsJson }}</pre>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { LocalStorage } from 'quasar';
import { useCollectionsStore } from '@/stores/collections';
import { useDocumentsStore } from '@/stores/documents';
import { exportToJson } from '@/shared/download';
import { referenceIncludeFields } from '@/shared/references';
import MonacoEditor from '@/components/MonacoEditor.vue';
import SearchResultItem from '@/components/search/SearchResultItem.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import type { SearchParams } from 'typesense/lib/Typesense/Documents';

const collectionsStore = useCollectionsStore();
const documentsStore = useDocumentsStore();
const STORAGE_KEY_SEARCH_HISTORY = 'typesense-search-history';

const history = ref<string[]>([]);
const searchParameters = ref<SearchParams<any>>({ q: '*', per_page: 10 });

/** Starting parameters that work on the open collection: its searchable text fields. */
function defaultParameters(): SearchParams<any> {
  const fields = collectionsStore.currentCollection?.fields ?? [];
  const queryBy = fields
    .filter(
      (f) => f.index !== false && ['string', 'string[]'].includes(f.type) && !f.name.includes('*'),
    )
    .map((f) => f.name)
    .join(',');
  const include = referenceIncludeFields(fields);
  return {
    q: '*',
    ...(queryBy ? { query_by: queryBy } : {}),
    ...(include ? { include_fields: include } : {}),
    page: 1,
    per_page: 10,
  };
}

function resetParameters() {
  searchParameters.value = defaultParameters();
  jsonError.value = null;
}

/** One-line summary of a saved search for the history list. */
function summarize(json: string) {
  try {
    const p = JSON.parse(json) as Record<string, unknown>;
    const text = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v) : '');
    const parts = [`q=${text(p.q)}`];
    if (p.filter_by) parts.push(`filter ${text(p.filter_by)}`);
    if (p.sort_by) parts.push(`sort ${text(p.sort_by)}`);
    return parts.join(' · ');
  } catch {
    return json.slice(0, 60);
  }
}
const jsonError = ref<string | null>(null);
const results = ref<any>(null);

const currentCollection = computed(() => collectionsStore.currentCollection);

const searchParametersJson = computed({
  get: () => JSON.stringify(searchParameters.value, null, 2),
  set: (json: string) => {
    try {
      searchParameters.value = JSON.parse(json);
      jsonError.value = null;
    } catch (e) {
      jsonError.value = `This isn't valid JSON yet: ${(e as Error).message}`;
    }
  },
});

const hits = computed(() => {
  if (!results.value?.hits) return [];

  return results.value.hits.map((item: any) => {
    const transformedItem = Object.assign({}, item.document);

    // Create a deep copy of the document structure for _highlightResult
    const createHighlightStructure = (obj: any): any => {
      if (obj === null || obj === undefined) {
        return { value: String(obj), matchLevel: 'none' };
      }

      if (Array.isArray(obj)) {
        return obj.map((subItem: any) => createHighlightStructure(subItem));
      }

      if (typeof obj === 'object') {
        const result: any = {};
        for (const key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            result[key] = createHighlightStructure(obj[key]);
          }
        }
        return result;
      }

      return { value: String(obj), matchLevel: 'none' };
    };

    transformedItem._highlightResult = createHighlightStructure(item.document);

    // Apply highlights to the appropriate nested paths
    item.highlights.forEach((h: any) => {
      const fieldPath = h.field.split('.');
      let current = transformedItem._highlightResult;

      // Navigate to the correct nested location
      for (let i = 0; i < fieldPath.length - 1; i++) {
        const pathSegment = fieldPath[i];
        if (current[pathSegment] !== undefined) {
          current = current[pathSegment];
        }
      }

      const finalKey = fieldPath[fieldPath.length - 1];
      if (current[finalKey] !== undefined) {
        if (Array.isArray(current[finalKey])) {
          // For arrays, we need to find the matching item or update all
          // This is a simplified approach - in a real scenario you might want
          // to match based on indices or content
          current[finalKey] = current[finalKey].map((item: any) => {
            if (typeof item === 'object' && item.value !== undefined) {
              return { ...item, value: h.snippet, matchLevel: 'full' };
            }
            return { value: h.snippet, matchLevel: 'full' };
          });
        } else if (typeof current[finalKey] === 'object' && current[finalKey].value !== undefined) {
          current[finalKey] = { value: h.snippet, matchLevel: 'full' };
        } else {
          current[finalKey] = { value: h.snippet, matchLevel: 'full' };
        }
      }
    });

    return transformedItem;
  });
});

const resultsJson = computed(() => JSON.stringify(results.value, null, 2));

const exportResults = () => {
  if (results.value) {
    exportToJson(results.value);
  }
};

const exportHits = () => {
  if (results.value?.hits) {
    const data = results.value.hits.map((h: any) => h.document);
    exportToJson(data);
  }
};

const saveHistory = () => {
  LocalStorage.set(
    `${STORAGE_KEY_SEARCH_HISTORY}-${currentCollection.value?.name || ''}`,
    history.value.slice(0, 20),
  );
};

const addToHistory = () => {
  const json = searchParametersJson.value;
  const index = history.value.indexOf(json);
  if (index === 0) return;
  if (index > 0) {
    history.value.splice(index, 1);
  }
  history.value.unshift(json);
  saveHistory();
};

const search = async () => {
  results.value = null;
  jsonError.value = null;
  addToHistory();
  try {
    results.value = await documentsStore.search(searchParameters.value);
  } catch (error) {
    jsonError.value = (error as Error).message;
  }
};

const loadHistory = () => {
  history.value =
    LocalStorage.getItem(`${STORAGE_KEY_SEARCH_HISTORY}-${currentCollection.value?.name || ''}`) ||
    [];
};

watch(
  () => currentCollection.value?.name,
  () => {
    loadHistory();
    resetParameters();
    results.value = null;
  },
  { immediate: true },
);
</script>

<style scoped lang="scss">
.json-search {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 16px;
  @media (max-width: 1023px) {
    grid-template-columns: 1fr;
  }
}

.editor-card {
  overflow: hidden;
}

.editor-card__bar {
  padding: 8px 12px;
  border-bottom: 1px solid var(--ts-rule);
}

.editor {
  height: 300px;
  @media (max-width: 599px) {
    height: 220px;
  }
  display: flex;
}

.json-error {
  padding: 8px 14px;
  font-size: 0.85rem;
  color: var(--q-negative);
  background: var(--ts-danger-soft);
}

.history {
  padding: 8px;
  max-height: 350px;
  overflow-y: auto;
}

.history__title {
  padding: 4px 6px 8px;
}

.history__item {
  display: block;
  width: 100%;
  padding: 6px 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--ts-ink-2);
  font-size: 0.78rem;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  &:hover {
    background: var(--ts-hover);
    color: var(--ts-ink);
  }
}

.results-bar {
  font-size: 0.85rem;
  strong {
    color: var(--ts-ink);
  }
}

.raw {
  padding: 16px;
  font-size: 0.8rem;
  overflow: auto;
  max-height: 60vh;
}
</style>
