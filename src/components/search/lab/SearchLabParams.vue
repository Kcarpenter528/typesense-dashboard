<template>
  <div class="params">
    <div v-for="def in defs" :key="def.key" class="params__item">
      <div class="params__label">
        <span class="params__name">{{ def.label }}</span>
        <q-icon name="sym_s_info" size="14px" class="params__info" tabindex="0">
          <q-tooltip max-width="260px" anchor="top middle" self="bottom middle">
            {{ def.hint }}
            <div class="text-caption q-mt-xs text-mono">{{ def.key }}</div>
          </q-tooltip>
        </q-icon>
      </div>

      <q-select
        v-if="def.kind === 'boolean'"
        dense
        outlined
        options-dense
        emit-value
        map-options
        :model-value="(modelValue[def.key] as boolean | '' | undefined) ?? ''"
        :options="booleanOptions(def)"
        :aria-label="def.label"
        @update:model-value="set(def.key, $event === '' ? undefined : $event)"
      />
      <q-select
        v-else-if="def.options"
        dense
        outlined
        clearable
        options-dense
        :model-value="(modelValue[def.key] as string | undefined) ?? null"
        :options="def.options"
        :placeholder="placeholder(def)"
        :aria-label="def.label"
        @update:model-value="set(def.key, $event ?? undefined)"
      />
      <q-input
        v-else-if="def.kind === 'number'"
        dense
        outlined
        type="number"
        :min="def.min"
        :max="def.max"
        :model-value="(modelValue[def.key] as number | undefined) ?? ''"
        :placeholder="placeholder(def)"
        :aria-label="def.label"
        @update:model-value="setNumber(def.key, $event)"
      />
      <q-input
        v-else
        dense
        outlined
        class="text-mono"
        debounce="250"
        :model-value="(modelValue[def.key] as string | undefined) ?? ''"
        :placeholder="placeholder(def)"
        :aria-label="def.label"
        @update:model-value="set(def.key, String($event ?? ''))"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { PARAM_DEFS } from '@/shared/searchLab';
import type { ParamDef } from '@/shared/searchLab';

const props = withDefaults(
  defineProps<{
    modelValue: Record<string, unknown>;
    /** Values inherited from the whole-request settings, shown as placeholders. */
    inherited?: Record<string, unknown>;
    defs?: ParamDef[];
  }>(),
  { inherited: () => ({}), defs: () => PARAM_DEFS },
);
const emit = defineEmits<{ 'update:modelValue': [value: Record<string, unknown>] }>();

function set(key: string, value: unknown) {
  const next = { ...props.modelValue };
  if (value === undefined || value === '') delete next[key];
  else next[key] = value;
  emit('update:modelValue', next);
}

function setNumber(key: string, raw: string | number | null) {
  const n = raw === '' || raw === null ? undefined : Number(raw);
  set(key, n === undefined || Number.isNaN(n) ? undefined : n);
}

/** What applies when this is left empty: the whole-request value, else Typesense's default. */
function placeholder(def: ParamDef): string {
  const inherited = props.inherited[def.key];
  if (inherited !== undefined && inherited !== '') {
    if (typeof inherited === 'boolean') return inherited ? 'on' : 'off';
    if (typeof inherited === 'string' || typeof inherited === 'number') return String(inherited);
  }
  return def.fallback;
}

function booleanOptions(def: ParamDef) {
  const inherited = props.inherited[def.key];
  const base = typeof inherited === 'boolean' ? (inherited ? 'on' : 'off') : def.fallback;
  return [
    { label: `Default (${base})`, value: '' },
    { label: 'On', value: true },
    { label: 'Off', value: false },
  ];
}
</script>

<style scoped lang="scss">
.params {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px 14px;
}

.params__item {
  min-width: 0;
}

.params__label {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
  font-size: 0.76rem;
  color: var(--ts-ink-2);
}

.params__info {
  color: var(--ts-ink-3);
  cursor: help;
  &:hover,
  &:focus-visible {
    color: var(--ts-primary);
  }
}
</style>
