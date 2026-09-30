<template>
  <q-page class="ts-page">
    <page-header
      title="Analytics rules"
      description="Rules collect what people search for and do, then write the results into a collection you can query, such as popular searches for autocomplete."
    >
      <q-btn
        unelevated
        no-caps
        color="primary"
        icon="sym_s_add"
        label="New rule"
        @click="newRule"
      />
    </page-header>

    <q-banner v-if="!store.data.features.analyticsRules" rounded class="analytics-off q-mb-md">
      <template #avatar><q-icon name="sym_s_info" /></template>
      Analytics rules need the server to start with search analytics turned on.
      <router-link to="/settings" class="ts-link">Generate a startup configuration</router-link>
      with <code>enable-search-analytics</code>.
    </q-banner>

    <q-table
      class="ts-table"
      flat
      bordered
      :filter="state.filter"
      :rows="analyticsStore.rules"
      :columns="columns"
      row-key="name"
      :pagination="{ rowsPerPage: 50, sortBy: 'name' }"
      :rows-per-page-options="[25, 50, 100, 0]"
    >
      <template #top>
        <q-input
          v-model="state.filter"
          class="ts-filter"
          dense
          outlined
          debounce="200"
          placeholder="Filter rules"
          aria-label="Filter rules"
        >
          <template #prepend><q-icon name="sym_s_search" size="18px" /></template>
        </q-input>
      </template>
      <template #body-cell-name="props">
        <q-td :props="props"
          ><code>{{ props.value }}</code></q-td
        >
      </template>
      <template #body-cell-type="props">
        <q-td :props="props">
          {{ typeInfo(props.row.type).label }}
          <div class="text-caption ts-faint">on {{ props.row.event_type || 'search' }} events</div>
        </q-td>
      </template>
      <template #body-cell-flow="props">
        <q-td :props="props">
          <span class="text-mono">{{ props.row.collection || '—' }}</span>
          <template v-if="props.row.params?.destination_collection">
            <q-icon name="sym_s_arrow_forward" size="14px" class="q-mx-xs ts-faint" />
            <span class="text-mono">{{ props.row.params.destination_collection }}</span>
          </template>
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
            aria-label="Edit rule"
            @click="editRule(props.row)"
          >
            <q-tooltip>Edit</q-tooltip>
          </q-btn>
          <q-btn
            flat
            round
            dense
            size="sm"
            icon="sym_s_delete"
            aria-label="Delete rule"
            class="ts-danger-hover"
            @click="deleteRule(props.row.name)"
          >
            <q-tooltip>Delete</q-tooltip>
          </q-btn>
        </q-td>
      </template>
      <template #no-data>
        <empty-state
          v-if="!state.filter"
          icon="sym_s_insights"
          title="Start collecting search analytics"
          body="A popular queries rule is a good first step: it builds a list of the searches people run most."
        >
          <q-btn unelevated no-caps color="primary" label="New rule" @click="newRule" />
        </empty-state>
        <div v-else class="full-width text-center ts-faint q-pa-lg">
          No rule matches “{{ state.filter }}”.
        </div>
      </template>
    </q-table>

    <side-sheet
      v-model="state.sheetOpen"
      :title="state.editing ? `Edit rule ${state.rule.name}` : 'New analytics rule'"
      width="min(640px, 100vw)"
    >
      <div class="ts-eyebrow q-mb-sm">What should this rule collect?</div>
      <div class="types q-mb-lg">
        <button
          v-for="t in RULE_TYPES"
          :key="t.value"
          type="button"
          class="type-card"
          :class="{ 'is-selected': state.rule.type === t.value }"
          @click="setType(t.value)"
        >
          <q-icon :name="t.icon" size="20px" />
          <span class="type-card__name">{{ t.label }}</span>
          <span class="type-card__hint">{{ t.hint }}</span>
        </button>
      </div>

      <q-form id="rule-form" class="column q-gutter-md" @submit="saveRule">
        <q-input
          v-model="state.rule.name"
          outlined
          label="Rule name"
          placeholder="popular-milestone-searches"
          :readonly="state.editing"
          lazy-rules
          :rules="[(val) => !!val || 'Enter a name']"
        />
        <q-select
          v-model="state.rule.event_type"
          outlined
          label="Events"
          :options="eventTypes"
          emit-value
          map-options
        />
        <template v-if="state.rule.type !== 'log'">
          <q-select
            v-model="state.rule.collection"
            outlined
            label="Collect from"
            :options="sourceOptions"
            hint="Searches or events on this collection or alias."
            lazy-rules
            :rules="[(val) => !!val || 'Choose a collection']"
          />
          <q-select
            v-model="params.destination_collection"
            outlined
            label="Write results to"
            :options="sourceOptions"
            :hint="
              state.rule.type === 'counter'
                ? 'The collection whose documents get counted.'
                : 'A collection with a q (string) and count (int32) field.'
            "
          />
        </template>
        <template v-if="state.rule.type === 'counter'">
          <q-input
            v-model="params.counter_field"
            outlined
            label="Counter field"
            placeholder="popularity"
            hint="A numeric field in the destination documents to add to."
          />
          <q-input
            v-model.number="params.weight"
            outlined
            type="number"
            min="0"
            label="Weight"
            hint="How much each event adds."
          />
        </template>
        <template
          v-if="state.rule.type === 'popular_queries' || state.rule.type === 'nohits_queries'"
        >
          <q-input
            v-model.number="params.limit"
            outlined
            type="number"
            min="1"
            label="Keep the top"
            suffix="queries"
          />
          <q-toggle
            v-model="params.expand_query"
            label="Store the full query, not just the typed prefix"
          />
          <q-toggle
            v-model="params.capture_search_requests"
            label="Count every search request automatically"
          />
        </template>
      </q-form>

      <q-expansion-item
        dense
        switch-toggle-side
        class="q-mt-lg"
        header-class="q-px-none ts-muted"
        label="Edit as JSON"
      >
        <div class="json-editor q-mt-sm">
          <monaco-editor v-model="ruleJson" />
        </div>
        <div v-if="state.jsonError" class="text-negative text-caption q-mt-xs">
          {{ state.jsonError }}
        </div>
      </q-expansion-item>

      <template #actions>
        <q-btn v-close-popup flat no-caps label="Cancel" />
        <q-btn
          unelevated
          no-caps
          color="primary"
          type="submit"
          form="rule-form"
          :label="state.editing ? 'Save rule' : 'Create rule'"
          :disable="!!state.jsonError"
        />
      </template>
    </side-sheet>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive } from 'vue';
import { useQuasar } from 'quasar';
import type { QTableProps } from 'quasar';
import type {
  AnalyticsRuleCreateSchema,
  AnalyticsRuleSchema,
} from 'typesense/lib/Typesense/AnalyticsRule';
import { useNodeStore } from '@/stores/node';
import { useAliasesStore } from '@/stores/aliases';
import { useAnalyticsRulesStore } from '@/stores/analyticsRules';
import { useCollectionsStore } from '@/stores/collections';
import MonacoEditor from '@/components/MonacoEditor.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import SideSheet from '@/components/ui/SideSheet.vue';
import EmptyState from '@/components/ui/EmptyState.vue';

type RuleType = AnalyticsRuleCreateSchema['type'];

interface RuleParams {
  destination_collection?: string;
  counter_field?: string;
  weight?: number;
  limit?: number;
  expand_query?: boolean;
  capture_search_requests?: boolean;
  [key: string]: unknown;
}

const $q = useQuasar();
const store = useNodeStore();
const aliasesStore = useAliasesStore();
const analyticsStore = useAnalyticsRulesStore();
const collectionsStore = useCollectionsStore();

const RULE_TYPES: { value: RuleType; label: string; hint: string; icon: string }[] = [
  {
    value: 'popular_queries',
    label: 'Popular searches',
    hint: 'For autocomplete and trends',
    icon: 'sym_s_trending_up',
  },
  {
    value: 'nohits_queries',
    label: 'Searches with no results',
    hint: 'Find content gaps',
    icon: 'sym_s_search_off',
  },
  {
    value: 'counter',
    label: 'Event counter',
    hint: 'Rank by clicks or sales',
    icon: 'sym_s_counter_1',
  },
  { value: 'log', label: 'Event log', hint: 'Keep raw events', icon: 'sym_s_receipt_long' },
];

const eventTypes = [
  { label: 'Searches', value: 'search' },
  { label: 'Clicks', value: 'click' },
  { label: 'Conversions', value: 'conversion' },
  { label: 'Visits', value: 'visit' },
];

function initialRule(type: RuleType = 'popular_queries'): AnalyticsRuleCreateSchema {
  return {
    name: '',
    type,
    collection: '',
    event_type: 'search',
    params:
      type === 'counter'
        ? { destination_collection: '', counter_field: '', weight: 1 }
        : type === 'log'
          ? {}
          : { destination_collection: '', expand_query: false, limit: 100 },
  };
}

const state = reactive<{
  rule: AnalyticsRuleCreateSchema;
  jsonError: string | null;
  sheetOpen: boolean;
  editing: boolean;
  filter: string;
}>({
  rule: initialRule(),
  jsonError: null,
  sheetOpen: false,
  editing: false,
  filter: '',
});

// Every path that sets state.rule goes through withParams, so params always exists.
const params = computed<RuleParams>(() => state.rule.params ?? {});

function withParams(rule: AnalyticsRuleCreateSchema): AnalyticsRuleCreateSchema {
  return { ...rule, params: rule.params ?? {} };
}

const columns: QTableProps['columns'] = [
  { label: 'Rule', name: 'name', field: 'name', align: 'left', sortable: true },
  { label: 'Collects', name: 'type', field: 'type', align: 'left', sortable: true },
  {
    label: 'From → to',
    name: 'flow',
    field: (r: AnalyticsRuleSchema) =>
      `${r.collection ?? ''} ${r.params?.destination_collection ?? ''}`,
    align: 'left',
  },
  {
    label: 'Keeps',
    name: 'limit',
    field: (r: AnalyticsRuleSchema) => (r.params?.limit ? `Top ${r.params.limit}` : ''),
    align: 'left',
  },
  { label: '', name: 'actions', field: 'name', align: 'right' },
];

const sourceOptions = computed(() =>
  [
    ...collectionsStore.collections.map((c) => c.name),
    ...aliasesStore.aliases.map((a) => a.name),
  ].sort(),
);

const ruleJson = computed({
  get: () => JSON.stringify(state.rule, null, 2),
  set: (json: string) => {
    try {
      state.rule = withParams(JSON.parse(json));
      state.jsonError = null;
    } catch (e) {
      state.jsonError = `This isn't valid JSON yet: ${(e as Error).message}`;
    }
  },
});

function typeInfo(type: string) {
  return RULE_TYPES.find((t) => t.value === type) ?? { label: type };
}

function setType(type: RuleType) {
  const { name, collection, event_type } = state.rule;
  state.rule = { ...initialRule(type), name, collection, event_type };
}

function newRule() {
  state.rule = initialRule();
  state.jsonError = null;
  state.editing = false;
  state.sheetOpen = true;
}

function editRule(rule: AnalyticsRuleSchema) {
  state.rule = withParams(JSON.parse(JSON.stringify(rule)));
  state.jsonError = null;
  state.editing = true;
  state.sheetOpen = true;
}

async function saveRule() {
  const message = state.editing ? 'Rule saved' : 'Rule created';
  await analyticsStore.upsert(state.rule);
  if (!store.error) {
    state.sheetOpen = false;
    $q.notify({ type: 'positive', message, position: 'top', timeout: 1500 });
  }
}

function deleteRule(name: string) {
  $q.dialog({
    title: `Delete rule ${name}?`,
    message: 'It stops collecting. Data it already wrote to its collection stays there.',
    cancel: { flat: true, noCaps: true, label: 'Cancel' },
    ok: { unelevated: true, noCaps: true, color: 'negative', label: 'Delete rule' },
  }).onOk(() => {
    void analyticsStore.remove(name);
  });
}

onMounted(() => {
  void analyticsStore.refresh();
});
</script>

<style scoped lang="scss">
.analytics-off {
  background: var(--ts-sheet);
  border: 1px solid var(--ts-rule);
  color: var(--ts-ink-2);
}

.types {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(135px, 1fr));
  gap: 8px;
}

.type-card {
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

.type-card__name {
  font-weight: 500;
  font-size: 0.875rem;
}

.type-card__hint {
  font-size: 0.75rem;
  color: var(--ts-ink-3);
}

.json-editor {
  height: 240px;
  display: flex;
  border: 1px solid var(--ts-rule);
  border-radius: 8px;
  overflow: hidden;
}
</style>
