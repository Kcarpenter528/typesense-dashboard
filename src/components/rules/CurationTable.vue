<template>
  <q-table
    class="ts-table"
    flat
    bordered
    :filter="filter"
    :rows="rows"
    :columns="columns"
    row-key="id"
    :pagination="{ rowsPerPage: 50 }"
    :rows-per-page-options="[25, 50, 100, 0]"
  >
    <template #top>
      <div class="row items-center justify-between full-width q-gutter-y-sm">
        <q-input
          v-model="filter"
          class="ts-filter"
          dense
          outlined
          debounce="200"
          placeholder="Filter curations"
          aria-label="Filter curations"
        >
          <template #prepend><q-icon name="sym_s_search" size="18px" /></template>
        </q-input>
        <q-btn
          unelevated
          no-caps
          color="primary"
          icon="sym_s_add"
          label="New curation"
          @click="emit('create')"
        />
      </div>
    </template>
    <template #body-cell-when="props">
      <q-td :props="props">
        <div class="when">{{ whenLabel(props.row) }}</div>
        <div v-if="props.row.rule?.tags?.length" class="text-caption ts-faint">
          Tags: {{ props.row.rule.tags.join(', ') }}
        </div>
      </q-td>
    </template>
    <template #body-cell-then="props">
      <q-td :props="props">
        <div class="effects">
          <span v-if="props.row.includes?.length" class="effect">
            <q-icon name="sym_s_push_pin" size="14px" /> Pins {{ props.row.includes.length }}
          </span>
          <span v-if="props.row.excludes?.length" class="effect">
            <q-icon name="sym_s_visibility_off" size="14px" /> Hides {{ props.row.excludes.length }}
          </span>
          <span v-if="props.row.filter_by" class="effect">Filters</span>
          <span v-if="props.row.sort_by" class="effect">Sorts</span>
          <span v-if="props.row.replace_query" class="effect">Replaces query</span>
        </div>
        <div v-if="activeWindow(props.row)" class="text-caption ts-faint">
          {{ activeWindow(props.row) }}
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
          aria-label="Edit curation"
          @click="emit('edit', props.row)"
        >
          <q-tooltip>Edit</q-tooltip>
        </q-btn>
        <q-btn
          flat
          round
          dense
          size="sm"
          icon="sym_s_delete"
          aria-label="Delete curation"
          class="ts-danger-hover"
          @click="emit('delete', props.row)"
        >
          <q-tooltip>Delete</q-tooltip>
        </q-btn>
      </q-td>
    </template>
    <template #no-data>
      <empty-state
        v-if="!filter"
        icon="sym_s_push_pin"
        title="Add a curation"
        body="Pin a document to the top, or hide one, whenever someone searches for a specific phrase."
      >
        <q-btn unelevated no-caps color="primary" label="New curation" @click="emit('create')" />
      </empty-state>
      <div v-else class="full-width text-center ts-faint q-pa-lg">
        No curation matches “{{ filter }}”.
      </div>
    </template>
  </q-table>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { QTableProps } from 'quasar';
import EmptyState from '@/components/ui/EmptyState.vue';
import type { RuleSetItem } from '@/shared/useRuleSets';

export interface CurationItem extends RuleSetItem {
  id: string;
  rule: { query?: string; match?: 'exact' | 'contains'; filter_by?: string; tags?: string[] };
  includes?: { id: string; position: number }[];
  excludes?: { id: string }[];
  filter_by?: string;
  sort_by?: string;
  replace_query?: string;
  remove_matched_tokens?: boolean;
  filter_curated_hits?: boolean;
  stop_processing?: boolean;
  effective_from_ts?: number;
  effective_to_ts?: number;
}

defineProps<{ rows: CurationItem[] }>();
const emit = defineEmits<{
  create: [];
  edit: [item: CurationItem];
  delete: [item: CurationItem];
}>();

const filter = ref('');

function whenLabel(row: CurationItem) {
  const parts: string[] = [];
  if (row.rule?.query) {
    parts.push(`Search ${row.rule.match === 'contains' ? 'contains' : 'is'} “${row.rule.query}”`);
  }
  if (row.rule?.filter_by) parts.push(`Filter matches ${row.rule.filter_by}`);
  if (!parts.length && row.rule?.tags?.length) parts.push('Search sends a matching tag');
  return parts.join(' and ') || 'Always';
}

function activeWindow(row: CurationItem) {
  if (!row.effective_from_ts && !row.effective_to_ts) return '';
  const date = (ts?: number) => (ts ? new Date(ts * 1000).toLocaleDateString() : '');
  if (row.effective_from_ts && row.effective_to_ts) {
    return `Active ${date(row.effective_from_ts)} to ${date(row.effective_to_ts)}`;
  }
  return row.effective_from_ts
    ? `Active from ${date(row.effective_from_ts)}`
    : `Active until ${date(row.effective_to_ts)}`;
}

const columns: QTableProps['columns'] = [
  { label: 'When', name: 'when', field: (row: CurationItem) => whenLabel(row), align: 'left' },
  {
    label: 'Then',
    name: 'then',
    field: (row: CurationItem) =>
      [...(row.includes ?? []).map((i) => i.id), ...(row.excludes ?? []).map((e) => e.id)].join(
        ' ',
      ),
    align: 'left',
  },
  { label: '', name: 'actions', field: 'id', align: 'right' },
];
</script>

<style scoped lang="scss">
.when {
  white-space: normal;
}

.effects {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.effect {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 8px;
  border-radius: 6px;
  background: var(--ts-sheet-2);
  border: 1px solid var(--ts-rule);
  font-size: 0.8rem;
  color: var(--ts-ink-2);
}
</style>
