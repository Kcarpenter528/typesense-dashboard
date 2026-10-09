<template>
  <section class="ts-sheet card">
    <header class="card__head">
      <q-select
        dense
        outlined
        options-dense
        class="card__collection text-mono"
        label="Collection"
        :model-value="search.collection"
        :options="collections"
        @update:model-value="emit('changeCollection', $event as string)"
      />
      <q-btn
        flat
        round
        dense
        size="sm"
        icon="sym_s_content_copy"
        aria-label="Duplicate this search"
        @click="emit('duplicate')"
      >
        <q-tooltip>Duplicate to compare two settings side by side</q-tooltip>
      </q-btn>
      <q-btn
        flat
        round
        dense
        size="sm"
        icon="sym_s_close"
        aria-label="Remove this search"
        class="ts-danger-hover"
        @click="emit('remove')"
      >
        <q-tooltip>Remove</q-tooltip>
      </q-btn>
    </header>

    <div class="card__stats">
      <template v-if="result && !result.error">
        <span>
          <strong>{{ result.found.toLocaleString() }}</strong> found
          <span class="ts-faint">of {{ result.outOf.toLocaleString() }}</span>
        </span>
        <span>{{ result.searchTimeMs }} ms</span>
        <span v-if="baseline && !baseline.error" class="ts-faint">{{ foundDelta }}</span>
      </template>
      <span v-else-if="running" class="ts-faint">Searching…</span>
      <span v-else class="ts-faint">No results yet</span>
    </div>

    <q-expansion-item
      v-model="settingsOpen"
      dense
      expand-separator
      label="Settings"
      header-class="card__section"
    >
      <div class="card__settings">
        <div>
          <div class="ts-eyebrow q-mb-xs row items-center">
            Fields and weights <help-tip topic="lab.query_by" class="q-ml-xs" />
          </div>
          <div v-if="!search.queryBy.length" class="ts-faint text-caption q-mb-xs">
            Add at least one field to search.
          </div>
          <ul class="fields">
            <li v-for="(field, i) in search.queryBy" :key="field" class="fields__row">
              <span class="fields__order">
                <q-btn
                  flat
                  round
                  dense
                  size="xs"
                  icon="sym_s_keyboard_arrow_up"
                  :disable="i === 0"
                  :aria-label="`Move ${field} up`"
                  @click="move(i, -1)"
                />
                <q-btn
                  flat
                  round
                  dense
                  size="xs"
                  icon="sym_s_keyboard_arrow_down"
                  :disable="i === search.queryBy.length - 1"
                  :aria-label="`Move ${field} down`"
                  @click="move(i, 1)"
                />
              </span>
              <span class="fields__name text-mono" :title="field">{{ field }}</span>
              <q-slider
                class="fields__slider"
                dense
                :min="0"
                :max="10"
                :step="1"
                label
                :model-value="search.weights[field] ?? autoWeight(i)"
                :color="hasWeights ? 'primary' : 'grey-5'"
                :aria-label="`Weight of ${field}`"
                @update:model-value="setWeight(field, $event)"
              />
              <span class="fields__weight text-mono">
                {{ hasWeights ? (search.weights[field] ?? 1) : 'auto' }}
              </span>
              <q-btn
                flat
                round
                dense
                size="xs"
                icon="sym_s_remove"
                :aria-label="`Stop searching ${field}`"
                @click="removeField(field)"
              />
            </li>
          </ul>
          <div class="row items-center q-gutter-x-sm q-mt-xs">
            <q-select
              dense
              outlined
              options-dense
              class="col"
              label="Add a field to search"
              :model-value="null"
              :options="unusedFields"
              :disable="!unusedFields.length"
              @update:model-value="addField($event as string)"
            />
            <q-btn
              v-if="hasWeights"
              flat
              dense
              no-caps
              size="sm"
              label="Use automatic weights"
              @click="patch({ weights: {} })"
            >
              <q-tooltip>Weight by field order, like Typesense does by default</q-tooltip>
            </q-btn>
          </div>
        </div>

        <div class="core">
          <q-input
            v-for="p in CORE_PARAMS"
            :key="p.key"
            dense
            outlined
            class="text-mono"
            debounce="250"
            :label="p.label"
            :placeholder="inheritedText(p.key) || p.placeholder"
            :model-value="(search.params[p.key] as string | undefined) ?? ''"
            @update:model-value="setParam(p.key, $event)"
          />
        </div>

        <q-expansion-item dense label="Matching and ranking" header-class="card__subsection">
          <div class="q-pt-sm">
            <search-lab-params
              :model-value="search.params"
              :inherited="common"
              @update:model-value="patch({ params: $event })"
            />
          </div>
        </q-expansion-item>

        <q-expansion-item dense label="Other parameters (JSON)" header-class="card__subsection">
          <q-input
            dense
            outlined
            autogrow
            type="textarea"
            class="text-mono q-mt-sm"
            debounce="400"
            placeholder='{ "vector_query": "embedding:([], k: 20)" }'
            :model-value="search.extra"
            :error="!!extraError"
            :error-message="extraError"
            @update:model-value="patch({ extra: String($event ?? '') })"
          />
        </q-expansion-item>
      </div>
    </q-expansion-item>

    <div class="card__results">
      <div v-if="result?.error" class="card__error">{{ result.error }}</div>
      <template v-else-if="result">
        <div v-if="dropped.length" class="card__dropped">
          Dropped out:
          <code v-for="d in dropped" :key="d.id"
            >{{ d.id }} <span>(was #{{ d.before }})</span></code
          >
        </div>
        <div v-if="result.facets.length" class="card__facets">
          <div v-for="f in result.facets" :key="f.field" class="facet">
            <span class="facet__name text-mono">{{ f.field }}</span>
            <span v-for="c in f.counts.slice(0, 6)" :key="c.value" class="facet__chip">
              {{ c.value }} <span class="ts-faint">{{ c.count }}</span>
            </span>
          </div>
        </div>
        <search-lab-hit
          v-for="hit in result.hits"
          :key="hit.id"
          :hit="hit"
          :query-by="search.queryBy"
          :change="changes.get(hit.id)"
          @expect="emit('expect', $event)"
        />
        <empty-state
          v-if="!result.hits.length"
          icon="sym_s_search_off"
          title="No documents match"
          body="Try fewer words, allow more typos, or remove a filter."
        />
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import HelpTip from '@/components/help/HelpTip.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import SearchLabHit from './SearchLabHit.vue';
import SearchLabParams from './SearchLabParams.vue';
import {
  CORE_PARAMS,
  diffHits,
  parseExtra,
  searchableFields,
  seedWeights,
} from '@/shared/searchLab';
import type { LabHit, LabResult, LabSearch, RankChange } from '@/shared/searchLab';

const props = defineProps<{
  search: LabSearch;
  result?: LabResult | undefined;
  /** This search's results when the baseline was pinned. */
  baseline?: LabResult | undefined;
  collections: string[];
  /** Fields of the chosen collection, for the field picker. */
  fields?: { name: string; type: string; index?: boolean }[] | undefined;
  common: Record<string, unknown>;
  running: boolean;
}>();

const emit = defineEmits<{
  'update:search': [search: LabSearch];
  changeCollection: [name: string];
  duplicate: [];
  remove: [];
  expect: [hit: LabHit];
}>();

const settingsOpen = ref(true);

const hasWeights = computed(() => Object.keys(props.search.weights).length > 0);
const extraError = computed(() => parseExtra(props.search.extra).error);

const unusedFields = computed(() =>
  searchableFields(props.fields).filter((f) => !props.search.queryBy.includes(f)),
);

function patch(partial: Partial<LabSearch>) {
  emit('update:search', { ...props.search, ...partial });
}

function setParam(key: string, value: string | number | null) {
  const params = { ...props.search.params };
  if (value === '' || value === null) delete params[key];
  else params[key] = value;
  patch({ params });
}

function inheritedText(key: string): string {
  const v = props.common[key];
  return typeof v === 'string' ? v : '';
}

function addField(field: string) {
  if (!field) return;
  const queryBy = [...props.search.queryBy, field];
  patch({
    queryBy,
    weights: hasWeights.value ? { ...props.search.weights, [field]: 1 } : {},
  });
}

function removeField(field: string) {
  const weights = { ...props.search.weights };
  delete weights[field];
  patch({
    queryBy: props.search.queryBy.filter((f) => f !== field),
    weights: Object.keys(weights).length ? weights : {},
  });
}

function move(index: number, by: -1 | 1) {
  const queryBy = [...props.search.queryBy];
  const target = index + by;
  const [field] = queryBy.splice(index, 1);
  if (field === undefined) return;
  queryBy.splice(target, 0, field);
  patch({ queryBy });
}

/** What the slider shows before any weight is set: Typesense's order-based default. */
function autoWeight(index: number): number {
  return Math.max(props.search.queryBy.length - index, 0);
}

/** The first change seeds every weight from field order so only the touched one jumps. */
function setWeight(field: string, value: number | null) {
  if (value === null) return;
  const weights = hasWeights.value
    ? { ...props.search.weights }
    : seedWeights(props.search.queryBy);
  weights[field] = value;
  patch({ weights });
}

const changes = computed(() => {
  const map = new Map<string, RankChange>();
  if (props.result && props.baseline && !props.baseline.error) {
    for (const c of diffHits(props.result.hits, props.baseline.hits)) map.set(c.id, c);
  }
  return map;
});

const dropped = computed(() => [...changes.value.values()].filter((c) => c.status === 'gone'));

const foundDelta = computed(() => {
  if (!props.result || !props.baseline) return '';
  const d = props.result.found - props.baseline.found;
  return d === 0
    ? 'same count as baseline'
    : `${d > 0 ? '+' : ''}${d.toLocaleString()} vs baseline`;
});
</script>

<style scoped lang="scss">
.card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

.card__head {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 10px 10px 6px 12px;
}

.card__collection {
  flex: 1;
  min-width: 0;
}

.card__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  padding: 0 14px 8px;
  font-size: 0.82rem;
  color: var(--ts-ink-2);
  strong {
    color: var(--ts-ink);
  }
}

.card__settings {
  display: grid;
  gap: 16px;
  padding: 4px 14px 14px;
}

.fields {
  margin: 0;
  padding: 0;
  list-style: none;
}

.fields__row {
  display: grid;
  grid-template-columns: auto minmax(70px, 130px) minmax(60px, 1fr) 34px auto;
  align-items: center;
  gap: 6px;
  min-height: 32px;
}

.fields__order {
  display: inline-flex;
  flex-direction: column;
}

.fields__name {
  font-size: 0.8rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fields__slider {
  margin: 0 6px;
}

.fields__weight {
  font-size: 0.75rem;
  color: var(--ts-ink-3);
  text-align: right;
}

.core {
  display: grid;
  gap: 10px;
}

.card__results {
  border-top: 1px solid var(--ts-rule);
  background: var(--ts-sheet);
}

.card__error {
  margin: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--ts-danger-soft);
  font-size: 0.85rem;
  overflow-wrap: anywhere;
}

.card__dropped {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  align-items: baseline;
  padding: 8px 12px;
  background: var(--ts-warning-soft);
  font-size: 0.78rem;
  code span {
    color: var(--ts-ink-3);
  }
}

.card__facets {
  display: grid;
  gap: 4px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--ts-rule);
  background: var(--ts-sheet-2);
  font-size: 0.78rem;
}

.facet {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 10px;
}

.facet__name {
  color: var(--ts-ink-3);
}

:deep(.card__section) {
  font-size: 0.78rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ts-ink-2);
  padding-left: 14px;
  padding-right: 14px;
}

:deep(.card__subsection) {
  padding-left: 0;
  padding-right: 0;
  font-size: 0.85rem;
  color: var(--ts-ink-2);
}
</style>
