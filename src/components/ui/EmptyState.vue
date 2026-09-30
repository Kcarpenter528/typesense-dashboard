<template>
  <div class="empty-state column items-center text-center">
    <div class="empty-state__icon" aria-hidden="true">
      <q-icon :name="icon" size="26px" />
    </div>
    <div class="empty-state__title">{{ title }}</div>
    <p v-if="body" class="empty-state__body">{{ body }}</p>
    <div v-if="$slots.default" class="q-mt-md">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  icon: string;
  title: string;
  body?: string;
}>();
</script>

<style scoped lang="scss">
.empty-state {
  padding: 48px 24px;
  width: 100%;
}

.empty-state__icon {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background: var(--ts-sheet-2);
  border: 1px solid var(--ts-rule);
  color: var(--ts-ink-2);
  margin-bottom: 14px;
}

.empty-state__title {
  font-family: var(--ts-font-display);
  font-weight: 600;
  font-size: 1.05rem;
  color: var(--ts-ink);
}

.empty-state__body {
  margin: 6px 0 0;
  max-width: 420px;
  color: var(--ts-ink-2);
  font-size: 0.9rem;
  line-height: 1.5;
}
</style>
