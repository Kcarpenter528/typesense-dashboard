<template>
  <side-sheet
    :model-value="modelValue"
    title="Set up search analytics"
    description="Creates the collections and rules that record what people search for."
    @update:model-value="emit('update:modelValue', $event)"
  >
    <q-form id="default-rules-form" class="column q-gutter-md" @submit.prevent="create">
      <q-select
        v-model="source"
        outlined
        label="Collect searches on"
        :options="collectionNames"
        hint="Searches on this collection are recorded."
        lazy-rules
        :rules="[(val) => !!val || 'Choose a collection']"
      />

      <div>
        <div class="ts-eyebrow q-mb-xs">What to collect</div>
        <q-checkbox v-model="options.popular" label="Popular searches" />
        <div class="option-hint">
          The terms people search for most, for charts and autocomplete.
        </div>
        <q-checkbox v-model="options.nohits" label="Searches with no results" />
        <div class="option-hint">Terms that found nothing, to show what content is missing.</div>
      </div>

      <div v-if="steps.length">
        <div class="ts-eyebrow q-mb-sm">This will</div>
        <ul class="plan">
          <li v-for="step in steps" :key="`${step.kind}:${step.name}`" class="plan__step">
            <q-icon
              :name="step.exists ? 'sym_s_check' : 'sym_s_add'"
              size="18px"
              :class="step.exists ? 'ts-faint' : 'plan__new'"
            />
            <span>
              {{ describe(step) }} <code>{{ step.name }}</code>
            </span>
          </li>
        </ul>
        <p class="ts-faint q-mt-sm q-mb-none note">
          Typesense writes results after each analytics flush, so charts fill in a little after
          people start searching. Each rule keeps the top 1,000 terms.
        </p>
      </div>
    </q-form>

    <template #actions>
      <q-btn v-close-popup flat no-caps label="Cancel" />
      <q-btn
        unelevated
        no-caps
        color="primary"
        type="submit"
        form="default-rules-form"
        label="Create"
        :loading="busy"
        :disable="!steps.length || allExist"
      />
    </template>
  </side-sheet>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import SideSheet from '@/components/ui/SideSheet.vue';
import { useAnalyticsRulesStore } from '@/stores/analyticsRules';
import { useCollectionsStore } from '@/stores/collections';
import { useNodeStore } from '@/stores/node';
import { applyPlan, planDefaultRules, type PlanStep } from '@/shared/defaultRules';

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; created: [] }>();

const $q = useQuasar();
const store = useNodeStore();
const collectionsStore = useCollectionsStore();
const analyticsStore = useAnalyticsRulesStore();

const source = ref('');
const options = reactive({ popular: true, nohits: true });
const busy = ref(false);

const collectionNames = computed(() => collectionsStore.collections.map((c) => c.name).sort());

const steps = computed(() =>
  source.value
    ? planDefaultRules(
        source.value,
        options,
        collectionNames.value,
        analyticsStore.rules.map((r) => r.name),
      )
    : [],
);
const allExist = computed(() => steps.value.every((s) => s.exists));

function describe(step: PlanStep) {
  if (step.kind === 'collection')
    return step.exists ? 'Use the collection' : 'Create the collection';
  return step.exists ? 'Keep the existing rule' : 'Create the rule';
}

// Start from the only collection, if there is just one.
watch(
  () => props.modelValue,
  (open) => {
    if (open && !source.value && collectionNames.value.length === 1) {
      source.value = collectionNames.value[0]!;
    }
  },
);

async function create() {
  if (!store.api) return;
  busy.value = true;
  try {
    store.setError(null);
    await applyPlan(store.api, steps.value);
    await Promise.all([analyticsStore.refresh(), collectionsStore.getCollections()]);
    emit('update:modelValue', false);
    emit('created');
    $q.notify({ type: 'positive', message: 'Search analytics is set up', position: 'top' });
  } catch (error) {
    store.setError((error as Error).message);
  } finally {
    busy.value = false;
  }
}
</script>

<style scoped lang="scss">
.option-hint {
  margin: -4px 0 8px 40px;
  font-size: 0.8rem;
  color: var(--ts-ink-3);
}

.plan {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid var(--ts-rule);
  border-radius: 10px;
  background: var(--ts-sheet-2);
}

.plan__step {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 14px;
  font-size: 0.875rem;

  & + & {
    border-top: 1px solid var(--ts-rule);
  }
}

.plan__new {
  color: var(--ts-primary);
}

.note {
  font-size: 0.8rem;
  line-height: 1.5;
}
</style>
