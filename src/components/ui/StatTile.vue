<template>
  <div class="stat ts-sheet">
    <div class="stat__label">{{ label }}</div>
    <div class="stat__value">{{ value }}</div>
    <div v-if="detail" class="stat__detail">{{ detail }}</div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string;
  value: string;
  detail?: string;
}>();
</script>

<style scoped lang="scss">
.stat {
  padding: 16px 18px;
}

.stat__label {
  font-size: 0.8rem;
  color: var(--ts-ink-2);
}

.stat__value {
  margin-top: 6px;
  font-size: 1.75rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.1;
  color: var(--ts-ink);
}

.stat__detail {
  margin-top: 4px;
  font-size: 0.75rem;
  color: var(--ts-ink-3);
}
</style>
