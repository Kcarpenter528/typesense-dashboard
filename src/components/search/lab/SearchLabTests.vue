<template>
  <section class="ts-sheet tests">
    <header class="tests__head">
      <div>
        <h2 class="ts-section-title row items-center">
          Test queries <help-tip topic="lab.tests" class="q-ml-xs" />
        </h2>
        <p class="tests__sub">
          Queries and the documents that should rank near the top for them. Run them after each
          change to catch a tweak that helps one search and hurts another.
        </p>
      </div>
      <div class="row items-center q-gutter-x-sm">
        <span v-if="summary.done" class="tests__score" :class="{ 'tests__score--ok': allPass }">
          {{ summary.passed }} / {{ tests.length }} pass
        </span>
        <q-btn flat no-caps icon="sym_s_add" label="Add test" @click="emit('add')" />
        <q-btn
          unelevated
          no-caps
          color="primary"
          icon="sym_s_play_arrow"
          label="Run all"
          :loading="running"
          :disable="!tests.length || disabled"
          @click="emit('run')"
        />
      </div>
    </header>

    <empty-state
      v-if="!tests.length"
      icon="sym_s_checklist"
      title="No test queries yet"
      body="Press the flag on a result to say “this should rank high for this query”, or add a test by hand."
    />

    <ul v-else class="tests__list">
      <li v-for="(test, i) in tests" :key="test.id" class="test">
        <q-icon
          :name="icon(test).name"
          :color="icon(test).color"
          size="22px"
          class="test__status"
          :aria-label="icon(test).label"
        >
          <q-tooltip>{{ icon(test).label }}</q-tooltip>
        </q-icon>
        <q-input
          dense
          outlined
          class="test__q"
          label="Query"
          debounce="250"
          :model-value="test.q"
          @update:model-value="update(i, { q: String($event ?? '') })"
        />
        <q-select
          dense
          outlined
          options-dense
          class="test__collection text-mono"
          label="In"
          :model-value="test.collection"
          :options="collectionOptions"
          emit-value
          map-options
          @update:model-value="update(i, { collection: $event as string })"
        />
        <q-input
          dense
          outlined
          class="test__ids text-mono"
          label="Should return IDs"
          placeholder="12, 40"
          debounce="250"
          :model-value="test.expect.join(', ')"
          @update:model-value="update(i, { expect: parseIds(String($event ?? '')) })"
        />
        <q-input
          dense
          outlined
          type="number"
          class="test__top"
          label="Within top"
          :min="1"
          :max="250"
          :model-value="test.top"
          @update:model-value="update(i, { top: Math.max(1, Number($event) || 1) })"
        />
        <q-btn
          flat
          round
          dense
          size="sm"
          icon="sym_s_delete"
          aria-label="Delete test"
          class="ts-danger-hover"
          @click="emit('remove', test.id)"
        />
        <div v-if="outcomes[test.id]" class="test__detail">
          <template v-if="outcomes[test.id]?.error">{{ outcomes[test.id]?.error }}</template>
          <template v-else>
            <span
              v-for="f in outcomes[test.id]?.found"
              :key="f.id"
              class="test__found"
              :class="{ 'test__found--bad': f.position === null || f.position > test.top }"
            >
              <code>{{ f.id }}</code>
              {{ f.position === null ? 'not returned' : `at #${f.position}` }}
            </span>
          </template>
        </div>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import HelpTip from '@/components/help/HelpTip.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import { parseIds } from '@/shared/searchLab';
import type { LabTest, TestOutcome } from '@/shared/searchLab';

const props = defineProps<{
  tests: LabTest[];
  outcomes: Record<string, TestOutcome>;
  collections: string[];
  running: boolean;
  disabled: boolean;
  summary: { done: number; passed: number };
}>();

const emit = defineEmits<{
  'update:tests': [tests: LabTest[]];
  add: [];
  remove: [id: string];
  run: [];
}>();

const collectionOptions = computed(() => [
  { label: 'Any collection', value: '' },
  ...props.collections.map((c) => ({ label: c, value: c })),
]);

const allPass = computed(
  () => props.summary.done > 0 && props.summary.passed === props.tests.length,
);

function update(index: number, partial: Partial<LabTest>) {
  const next = props.tests.slice();
  const current = next[index];
  if (current) next[index] = { ...current, ...partial };
  emit('update:tests', next);
}

function icon(test: LabTest) {
  const outcome = props.outcomes[test.id];
  if (!outcome)
    return { name: 'sym_s_radio_button_unchecked', color: 'grey-6', label: 'Not run yet' };
  if (outcome.pass) return { name: 'sym_s_check_circle', color: 'positive', label: 'Passing' };
  return { name: 'sym_s_cancel', color: 'negative', label: 'Failing' };
}
</script>

<style scoped lang="scss">
.tests {
  margin-top: 24px;
  padding: 16px 18px;
}

.tests__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.tests__sub {
  max-width: 560px;
  margin: 4px 0 0;
  font-size: 0.85rem;
  color: var(--ts-ink-2);
}

.tests__score {
  font-weight: 600;
  color: var(--q-negative);
}

.tests__score--ok {
  color: var(--q-positive);
}

.tests__list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.test {
  display: grid;
  grid-template-columns:
    24px minmax(140px, 2fr) minmax(130px, 1.2fr) minmax(130px, 1.4fr)
    100px auto;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-top: 1px solid var(--ts-rule);
  @media (max-width: 899px) {
    grid-template-columns: 24px 1fr 1fr auto;
    .test__q {
      grid-column: 2 / 4;
    }
    .test__ids {
      grid-column: 2 / 4;
    }
  }
}

.test__detail {
  grid-column: 2 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  font-size: 0.78rem;
  color: var(--ts-ink-2);
}

.test__found--bad {
  color: var(--q-negative);
}
</style>
