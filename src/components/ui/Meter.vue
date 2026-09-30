<template>
  <div class="meter" :class="`is-${level}`">
    <div class="meter__head row items-baseline no-wrap">
      <span class="meter__label">{{ label }}</span>
      <q-icon
        v-if="level !== 'ok'"
        :name="level === 'critical' ? 'sym_s_error' : 'sym_s_warning'"
        size="16px"
        class="meter__icon"
      />
      <span v-if="level !== 'ok'" class="meter__state">{{
        level === 'critical' ? 'Critical' : 'High'
      }}</span>
      <q-space />
      <span class="meter__value">{{ valueLabel }}</span>
    </div>
    <div
      class="meter__track"
      role="meter"
      :aria-label="label"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="percent"
      :aria-valuetext="valueLabel"
    >
      <div class="meter__fill" :style="{ width: `${percent}%` }" />
    </div>
    <div v-if="detail" class="meter__detail">{{ detail }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    label: string;
    /** 0 to 1. */
    ratio: number;
    valueLabel: string;
    detail?: string;
    warnAt?: number;
    criticalAt?: number;
  }>(),
  { detail: '', warnAt: 0.8, criticalAt: 0.9 },
);

const percent = computed(() => Math.round(Math.max(0, Math.min(1, props.ratio)) * 100));
const level = computed(() =>
  props.ratio >= props.criticalAt ? 'critical' : props.ratio >= props.warnAt ? 'warning' : 'ok',
);
</script>

<style scoped lang="scss">
.meter {
  --meter-fill: var(--ts-primary);
  --meter-track: var(--ts-primary-soft);
  &.is-warning {
    --meter-fill: var(--q-warning);
    --meter-track: var(--ts-warning-soft);
  }
  &.is-critical {
    --meter-fill: var(--q-negative);
    --meter-track: var(--ts-danger-soft);
  }
}

.meter__head {
  gap: 6px;
  margin-bottom: 6px;
}

.meter__label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--ts-ink);
}

.meter__icon {
  color: var(--meter-fill);
}

.meter__state {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--meter-fill);
}

.meter__value {
  font-size: 0.875rem;
  color: var(--ts-ink-2);
  font-variant-numeric: tabular-nums;
}

.meter__track {
  height: 8px;
  border-radius: 4px;
  background: var(--meter-track);
  overflow: hidden;
}

.meter__fill {
  height: 100%;
  border-radius: 4px;
  background: var(--meter-fill);
  transition: width 0.4s ease;
}

.meter__detail {
  margin-top: 4px;
  font-size: 0.75rem;
  color: var(--ts-ink-3);
}
</style>
