<template>
  <ais-instant-search
    v-if="searchClient && currentCollection"
    :search-client="searchClient"
    :index-name="currentCollection.name"
    :middlewares="middlewares"
    class="search"
  >
    <ais-configure :hits-per-page.camel="12" />
    <div class="search__bar">
      <ais-search-box v-slot="{ currentRefinement, refine }">
        <debounced-search-box :model-value="currentRefinement" @refine="refine" />
      </ais-search-box>
      <ais-current-refinements v-slot="{ items }">
        <q-btn
          outline
          no-caps
          class="search__filters-toggle"
          icon="sym_s_tune"
          :label="$q.screen.gt.xs ? 'Filters and sort' : undefined"
          aria-label="Filters and sort"
          :aria-expanded="filtersOpen"
          aria-controls="search-filters"
          @click="filtersOpen = !filtersOpen"
        >
          <q-badge v-if="items.length" rounded color="primary" class="q-ml-sm">
            {{ items.length }}
          </q-badge>
        </q-btn>
      </ais-current-refinements>
    </div>

    <!-- Kept mounted while closed so a refinement isn't dropped when the panel is hidden. -->
    <section v-show="filtersOpen" id="search-filters" class="ts-sheet filters">
      <div class="filters__group">
        <div class="ts-eyebrow q-mb-xs">Sort</div>
        <ais-sort-by :items="sortBy" />
        <div class="ts-eyebrow q-mt-md q-mb-xs">Results per page</div>
        <ais-hits-per-page
          :items="[
            { label: '12', value: 12, default: true },
            { label: '48', value: 48 },
            { label: '100', value: 100 },
            { label: '250', value: 250 },
          ]"
        />
      </div>

      <div
        v-for="name in [...facetStringFields, ...facetBooleanFields]"
        :key="name"
        class="filters__group"
      >
        <div class="facet-title text-mono">{{ name }}</div>
        <ais-refinement-list
          :searchable="facetStringFields.includes(name)"
          :attribute="name"
          :searchable-placeholder="`Find a ${name}`"
        />
      </div>

      <div v-for="name in facetNumberFields" :key="name" class="filters__group">
        <div class="facet-title text-mono">{{ name }}</div>
        <ais-range-input :attribute="name" />
      </div>

      <div class="filters__group">
        <div class="ts-eyebrow q-mb-xs">Stopwords</div>
        <q-select
          v-model="currentStopwordsSet"
          :disable="!store.data.features.stopwords"
          outlined
          clearable
          dense
          options-dense
          placeholder="None"
          :options="stopwords"
          @update:model-value="updateTypesenseAdapterConfiguration()"
        />
        <div class="ts-eyebrow q-mt-md q-mb-xs">Max candidates</div>
        <q-input
          v-model.number="maxCandidates"
          type="number"
          outlined
          dense
          :min="0"
          :max="10000"
          hint="Similar words considered for prefix and typo matches."
          @update:model-value="updateTypesenseAdapterConfiguration()"
        />
      </div>
    </section>

    <div class="search__meta">
      <ais-stats v-slot="{ nbHits, processingTimeMS }">
        <span class="ts-muted">
          <strong>{{ nbHits.toLocaleString() }}</strong> results · {{ processingTimeMS }} ms
        </span>
      </ais-stats>
      <ais-current-refinements class="search__chips" />
      <q-btn
        flat
        dense
        no-caps
        size="sm"
        icon="sym_s_download"
        label="Export this page"
        class="search__export"
        @click="exportPage()"
      />
    </div>

    <section class="search__results">
      <ais-hits>
        <template v-if="currentCollection" #item="{ item }">
          <search-result-item :item="item" @deleted="instantSearchInstance.refresh()" />
        </template>
      </ais-hits>
      <ais-pagination class="q-my-lg" />
    </section>
  </ais-instant-search>
  <div v-else-if="searchClientError" class="error-card">
    {{ searchClientError }}
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useNodeStore } from '@/stores/node';
import { useCollectionsStore } from '@/stores/collections';
import { useStopwordsStore } from '@/stores/stopwords';
import { exportToJson } from '@/shared/download';
import { referenceIncludeFields } from '@/shared/references';
import SearchResultItem from '@/components/search/SearchResultItem.vue';
import DebouncedSearchBox from '@/components/search/DebouncedSearchBox.vue';
import TypesenseInstantSearchAdapter from 'typesense-instantsearch-adapter';
import type { CollectionSchema } from 'typesense/lib/Typesense/Collection';
import type { ConfigurationOptions } from 'typesense/lib/Typesense/Configuration';

const store = useNodeStore();
const collectionsStore = useCollectionsStore();
const stopwordsStore = useStopwordsStore();
const searchClient = ref<any>(null);
const typesenseInstantsearchAdapter = ref<TypesenseInstantSearchAdapter>();
const instantSearchInstance = ref<any>();
const searchClientError = ref<string | null>(null);
const currentStopwordsSet = ref(null);
const maxCandidates = ref(4);
const filtersOpen = ref(false);

const middlewares = [
  ({ instantSearchInstance: instance }: any) => {
    return {
      subscribe() {
        instantSearchInstance.value = instance;
      },
      unsubscribe() {
        instantSearchInstance.value = null;
      },
    };
  },
];

const currentCollection = computed((): CollectionSchema | null => {
  return collectionsStore.currentCollection;
});

const facetNumberFields = computed((): string[] => {
  if (!currentCollection.value || !currentCollection.value.fields) return [];
  return currentCollection.value.fields
    .filter(
      (f) =>
        f.facet &&
        ['int32', 'int64', 'float', 'int32[]', 'int64[]', 'float[]'].includes(f.type) &&
        !f.name.includes('.*'),
    )
    .map((f) => f.name);
});

const facetStringFields = computed((): string[] => {
  if (!currentCollection.value || !currentCollection.value.fields) return [];
  return currentCollection.value.fields
    .filter((f) => f.facet && ['string', 'string[]'].includes(f.type) && !f.name.includes('.*'))
    .map((f) => f.name);
});

const facetBooleanFields = computed((): string[] => {
  if (!currentCollection.value || !currentCollection.value.fields) return [];
  return currentCollection.value.fields
    .filter((f) => f.facet && ['bool', 'bool[]'].includes(f.type) && !f.name.includes('.*'))
    .map((f) => f.name);
});

const sortBy = computed((): { value: string; label: string }[] => {
  if (!currentCollection.value || !currentCollection.value.fields) return [];
  const sortBy = [{ value: currentCollection.value.name, label: 'Default' }];
  currentCollection.value.fields
    .filter(
      (f) =>
        !f.name.includes('*') &&
        ((['int32', 'int64', 'float', 'bool'].includes(f.type) && f.sort !== false) ||
          (f.type === 'string' && f.sort)),
    )
    .forEach((f) => {
      if (!currentCollection.value) return;
      sortBy.push({
        value: `${currentCollection.value.name}/sort/${f.name}:asc`,
        label: `${f.name} asc`,
      });
      sortBy.push({
        value: `${currentCollection.value.name}/sort/${f.name}:desc`,
        label: `${f.name} desc`,
      });
    });
  return sortBy;
});

const stopwords = computed(() => {
  return stopwordsStore.stopwords.map((set) => set.id);
});

const exportPage = () => {
  if (instantSearchInstance.value && currentCollection.value) {
    exportToJson(
      instantSearchInstance.value.renderState[currentCollection.value.name].hits.results.hits,
    );
  }
};

const updateTypesenseAdapterConfiguration = () => {
  if (typesenseInstantsearchAdapter.value && currentCollection.value) {
    typesenseInstantsearchAdapter.value.updateConfiguration({
      // @ts-expect-error internal property
      ...typesenseInstantsearchAdapter.value.configuration,
      additionalSearchParameters: {
        // @ts-expect-error internal property
        ...typesenseInstantsearchAdapter.value.configuration.additionalSearchParameters,
        stopwords: currentStopwordsSet.value,
        max_candidates: maxCandidates.value,
      },
    });
  }
};

watch(
  () => currentCollection.value,
  () => {
    searchClient.value = null;
    searchClientError.value = null;

    window.setTimeout(() => {
      if (!store.loginData || !currentCollection.value) return;
      const query_by = (currentCollection.value?.fields || [])
        .filter((f) => f.index && ['string', 'string[]'].includes(f.type) && !f.name.includes('.*'))
        .map((f) => f.name)
        .join(',');
      const include_fields = referenceIncludeFields(currentCollection.value?.fields);

      try {
        const serverConfig: ConfigurationOptions = {
          nodes: [{ ...store.loginData.node }],
          apiKey: store.loginData.apiKey,
        };
        if (store.loginData.connectionTimeoutSeconds !== undefined) {
          serverConfig.connectionTimeoutSeconds = store.loginData.connectionTimeoutSeconds;
        }
        const adapter = new TypesenseInstantSearchAdapter({
          server: serverConfig,
          additionalSearchParameters: {
            max_candidates: maxCandidates.value,
            query_by,
            ...(include_fields ? { include_fields } : {}),
          },
        });
        typesenseInstantsearchAdapter.value = adapter;
        searchClient.value = adapter.searchClient;
      } catch (error) {
        searchClientError.value = (error as Error).message + 'Using query_by: ' + query_by;
        console.error(error);
      }
    });
  },
  { immediate: true },
);
</script>

<style lang="scss" scoped>
.search__bar {
  display: flex;
  gap: 8px;
  align-items: center;
}

.search__bar > .ais-SearchBox {
  flex: 1;
  min-width: 0;
}

.search__filters-toggle {
  flex: none;
  height: 40px;
  color: var(--ts-ink);
  border-color: var(--ts-rule-strong);
}

.filters {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 20px 28px;
  align-items: start;
  margin-top: 12px;
  padding: 16px 20px;
  @media (max-width: 599px) {
    grid-template-columns: minmax(0, 1fr);
    padding: 14px 16px;
  }
}

.filters__group {
  min-width: 0;
}

.facet-title {
  font-size: 0.8rem;
  font-weight: 500;
  margin-bottom: 8px;
}

.search__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 16px;
  min-height: 28px;
  margin: 14px 0 12px;
  font-size: 0.85rem;
  strong {
    color: var(--ts-ink);
  }
}

.search__chips {
  flex: 1;
  min-width: 0;
}

.search__export {
  margin-left: auto;
}

.error-card {
  padding: 16px;
  border-radius: 12px;
  background: var(--ts-danger-soft);
  border: 1px solid rgba(200, 50, 75, 0.3);
}
</style>
