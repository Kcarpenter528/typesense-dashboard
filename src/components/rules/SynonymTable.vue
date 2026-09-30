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
          placeholder="Filter synonyms"
          aria-label="Filter synonyms"
        >
          <template #prepend><q-icon name="sym_s_search" size="18px" /></template>
        </q-input>
        <q-btn
          unelevated
          no-caps
          color="primary"
          icon="sym_s_add"
          label="New synonym"
          @click="emit('create')"
        />
      </div>
    </template>
    <template #body-cell-words="props">
      <q-td :props="props">
        <div class="words">
          <template v-if="props.row.root">
            <span class="word is-root">{{ props.row.root }}</span>
            <q-icon name="sym_s_arrow_forward" size="14px" class="ts-faint" />
          </template>
          <template v-for="(word, i) in wordsOf(props.row)" :key="word">
            <span v-if="i > 0 && !props.row.root" class="ts-faint">=</span>
            <span class="word">{{ word }}</span>
          </template>
        </div>
      </q-td>
    </template>
    <template #body-cell-kind="props">
      <q-td :props="props" class="ts-muted">
        {{ props.row.root ? 'One-way' : 'Same meaning' }}
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
          aria-label="Edit synonym"
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
          aria-label="Delete synonym"
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
        icon="sym_s_join"
        title="Add a synonym"
        body="For example, make open, active and in progress all find the same milestones."
      >
        <q-btn unelevated no-caps color="primary" label="New synonym" @click="emit('create')" />
      </empty-state>
      <div v-else class="full-width text-center ts-faint q-pa-lg">
        No synonym matches “{{ filter }}”.
      </div>
    </template>
  </q-table>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { QTableProps } from 'quasar';
import EmptyState from '@/components/ui/EmptyState.vue';
import type { RuleSetItem } from '@/shared/useRuleSets';

export interface SynonymItem extends RuleSetItem {
  id: string;
  synonyms: string[];
  root?: string;
  locale?: string;
  symbols_to_index?: string[];
}

defineProps<{ rows: SynonymItem[] }>();
const emit = defineEmits<{ create: []; edit: [item: SynonymItem]; delete: [item: SynonymItem] }>();

const filter = ref('');

function wordsOf(row: SynonymItem): string[] {
  return row.synonyms;
}

const columns: QTableProps['columns'] = [
  {
    label: 'Words',
    name: 'words',
    field: (row: SynonymItem) => [row.root ?? '', ...row.synonyms].join(' '),
    align: 'left',
  },
  {
    label: 'Match',
    name: 'kind',
    field: (row: SynonymItem) => (row.root ? 'one-way' : 'same'),
    align: 'left',
  },
  { label: '', name: 'actions', field: 'id', align: 'right' },
];
</script>

<style scoped lang="scss">
.words {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  white-space: normal;
}

.word {
  padding: 2px 9px;
  border-radius: 6px;
  background: var(--ts-sheet-2);
  border: 1px solid var(--ts-rule);
  font-size: 0.85rem;
  &.is-root {
    background: var(--ts-mark);
    border-color: transparent;
    color: var(--ts-mark-ink);
  }
}
</style>
