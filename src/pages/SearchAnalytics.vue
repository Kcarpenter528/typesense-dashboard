<template>
  <q-page class="ts-page">
    <page-header
      help="searchAnalytics"
      title="Search analytics"
      description="What people search for, what they can't find, and what they click. Read from the collections your analytics rules write to."
    >
      <q-btn-toggle
        v-model="topN"
        class="ts-toggle"
        unelevated
        no-caps
        dense
        toggle-color="primary"
        :options="[
          { label: 'Top 10', value: 10 },
          { label: 'Top 25', value: 25 },
        ]"
        aria-label="How many rows to show"
      />
      <q-btn flat no-caps icon="sym_s_refresh" label="Refresh" :loading="loading" @click="load" />
      <q-btn
        v-if="store.data.features.analyticsRules"
        outline
        no-caps
        icon="sym_s_add_chart"
        label="Set up rules"
        @click="setupOpen = true"
      />
      <q-btn outline no-caps icon="sym_s_insights" label="Analytics rules" to="/analyticsrules" />
    </page-header>

    <empty-state
      v-if="!store.data.features.analyticsRules"
      class="ts-sheet"
      icon="sym_s_bar_chart"
      title="Search analytics is off"
      body="The server needs to start with search analytics turned on before it can collect searches."
    >
      <q-btn unelevated no-caps color="primary" label="Open server settings" to="/settings" />
    </empty-state>

    <empty-state
      v-else-if="loaded && !cards.length"
      class="ts-sheet"
      icon="sym_s_bar_chart"
      title="No search data to chart yet"
      body="Set up rules for popular searches and searches with no results, and this page will chart what they collect."
    >
      <q-btn
        unelevated
        no-caps
        color="primary"
        icon="sym_s_add_chart"
        label="Set up rules"
        @click="setupOpen = true"
      />
    </empty-state>

    <template v-else>
      <div v-if="queries.length" class="kpis">
        <stat-tile
          label="Most searched"
          :value="topTerm ? topTerm.q : '—'"
          :detail="topTerm ? `${topTerm.count.toLocaleString()} searches` : ''"
        />
        <stat-tile
          label="Unique searches"
          :value="popular?.found !== undefined ? popular.found.toLocaleString() : '—'"
          detail="distinct terms recorded"
        />
        <stat-tile
          label="Searches with no results"
          :value="nohits?.found !== undefined ? nohits.found.toLocaleString() : '—'"
          detail="distinct terms that found nothing"
        />
      </div>

      <div class="charts">
        <section v-for="card in cards" :key="card.key" class="ts-sheet card">
          <div class="card__head">
            <h2 class="ts-section-title">{{ card.title }}</h2>
            <div class="ts-eyebrow q-mt-xs">
              <template v-if="card.from">
                from <code>{{ card.from }}</code> ·
              </template>
              {{ card.storedLabel }} <code>{{ card.stored }}</code>
            </div>
          </div>

          <div v-if="card.error" class="card__note">
            <q-icon name="sym_s_error" size="18px" />
            {{ card.error }}
          </div>
          <div v-else-if="!card.rows.length" class="card__note">{{ card.empty }}</div>
          <bar-chart
            v-else
            :labels="card.rows.map((r) => r.q)"
            :values="card.rows.map((r) => r.count)"
            :tone="card.tone"
            :unit="card.unit"
            :aria-label="`${card.title}: ${card.rows.map((r) => `${r.q}, ${r.count}`).join('; ')}`"
          />
        </section>

        <section v-if="activity.length" class="ts-sheet card">
          <div class="card__head">
            <h2 class="ts-section-title">Event activity</h2>
            <div class="ts-eyebrow q-mt-xs">Counters reported by the server</div>
          </div>
          <bar-chart
            :labels="activity.map((r) => r.q)"
            :values="activity.map((r) => r.count)"
            unit="events"
            aria-label="Analytics events recorded by the server"
          />
        </section>
      </div>
    </template>

    <default-rules-sheet v-model="setupOpen" @created="load" />
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import DefaultRulesSheet from '@/components/analytics/DefaultRulesSheet.vue';
import BarChart from '@/components/ui/BarChart.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import StatTile from '@/components/ui/StatTile.vue';
import { useAnalyticsRulesStore } from '@/stores/analyticsRules';
import { useNodeStore } from '@/stores/node';
import {
  counterSources,
  counterWords,
  labelField,
  queryRows,
  querySources,
  statusRows,
  type CounterSource,
  type QueryRow,
  type QuerySource,
} from '@/shared/searchAnalytics';

interface Card {
  key: string;
  title: string;
  from?: string;
  storedLabel: string;
  stored: string;
  rows: QueryRow[];
  tone: 'primary' | 'warning';
  unit: string;
  empty: string;
  error?: string;
}

interface QueryResult {
  source: QuerySource;
  rows: QueryRow[];
  /** Distinct terms in the whole collection, not just the rows shown. */
  found?: number | undefined;
  error?: string;
}

interface CounterResult {
  source: CounterSource;
  rows: QueryRow[];
  error?: string;
}

const store = useNodeStore();
const analyticsStore = useAnalyticsRulesStore();

const topN = ref(10);
const loading = ref(false);
const loaded = ref(false);
const setupOpen = ref(false);
const queries = ref<QueryResult[]>([]);
const counters = ref<CounterResult[]>([]);
const activity = ref<QueryRow[]>([]);

const popular = computed(() => queries.value.find((r) => r.source.kind === 'popular'));
const nohits = computed(() => queries.value.find((r) => r.source.kind === 'nohits'));
const topTerm = computed(() => popular.value?.rows[0]);

const cards = computed<Card[]>(() => [
  ...queries.value.map((r): Card => {
    const isNohits = r.source.kind === 'nohits';
    return {
      key: `q:${r.source.destination}`,
      title: isNohits ? 'Searches with no results' : 'Most popular searches',
      from: r.source.collection,
      storedLabel: 'stored in',
      stored: r.source.destination,
      rows: r.rows,
      tone: isNohits ? 'warning' : 'primary',
      unit: 'searches',
      empty: isNohits
        ? 'Every search has found something so far.'
        : 'No searches recorded yet. Typesense writes them after each analytics flush.',
      ...(r.error ? { error: r.error } : {}),
    };
  }),
  ...counters.value.map((r): Card => {
    const words = counterWords(r.source);
    return {
      key: `c:${r.source.destination}:${r.source.counterField}`,
      title: words.heading,
      storedLabel: 'counted in',
      stored: `${r.source.destination}.${r.source.counterField}`,
      rows: r.rows,
      tone: 'primary',
      unit: words.unit,
      empty: `No document has a ${r.source.counterField} above zero yet. Send ${r.source.eventType || 'counter'} events to start counting.`,
      ...(r.error ? { error: r.error } : {}),
    };
  }),
]);

async function readQueries(source: QuerySource): Promise<QueryResult> {
  try {
    const response = await store.api?.search(source.destination, {
      q: '*',
      sort_by: 'count:desc',
      per_page: topN.value,
    });
    return { source, rows: queryRows(response?.hits), found: response?.found };
  } catch (error) {
    return {
      source,
      rows: [],
      error: `Couldn't read ${source.destination}: ${(error as Error).message}`,
    };
  }
}

async function readCounter(source: CounterSource): Promise<CounterResult> {
  try {
    const schema = await store.api?.getCollection(source.destination);
    const label = labelField(schema?.fields, source.counterField);
    const response = await store.api?.search(source.destination, {
      q: '*',
      sort_by: `${source.counterField}:desc`,
      filter_by: `${source.counterField}:>0`,
      include_fields: ['id', label, source.counterField].filter(Boolean).join(','),
      per_page: topN.value,
    });
    const rows: QueryRow[] = [];
    for (const hit of response?.hits ?? []) {
      const doc = hit.document as Record<string, unknown>;
      const count = doc[source.counterField];
      if (typeof count !== 'number') continue;
      const name = label ? doc[label] : undefined;
      rows.push({ q: typeof name === 'string' && name ? name : String(doc.id), count });
    }
    return { source, rows };
  } catch (error) {
    return {
      source,
      rows: [],
      error: `Couldn't read ${source.destination}: ${(error as Error).message}`,
    };
  }
}

async function readActivity(): Promise<QueryRow[]> {
  try {
    return statusRows(await store.api?.getAnalyticsStatus());
  } catch {
    // Older servers don't have this endpoint; the card just stays hidden.
    return [];
  }
}

async function load() {
  if (!store.data.features.analyticsRules) return;
  loading.value = true;
  try {
    await analyticsStore.refresh();
    const rules = analyticsStore.rules;
    [queries.value, counters.value, activity.value] = await Promise.all([
      Promise.all(querySources(rules).map(readQueries)),
      Promise.all(counterSources(rules).map(readCounter)),
      readActivity(),
    ]);
  } finally {
    loading.value = false;
    loaded.value = true;
  }
}

onMounted(load);
watch(topN, load);
// The rules probe finishes after the first render on a fresh page load.
watch(() => store.data.features.analyticsRules, load);
</script>

<style scoped lang="scss">
.kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
  margin-bottom: 16px;

  :deep(.stat__value) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.charts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 460px), 1fr));
  gap: 16px;
}

.card {
  padding: 20px 22px 22px;
  min-width: 0;
}

.card__head {
  margin-bottom: 14px;
}

.card__note {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 28px 0;
  color: var(--ts-ink-2);
  font-size: 0.9rem;
}

.ts-toggle {
  border: 1px solid var(--ts-rule-strong);
  border-radius: 8px;
}
</style>
