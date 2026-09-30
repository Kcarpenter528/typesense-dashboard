<template>
  <header class="page-header">
    <div class="page-header__text">
      <h1 class="ts-title">
        <slot name="title">{{ title }}</slot>
      </h1>
      <p v-if="description || $slots.description" class="page-header__description">
        <slot name="description">{{ description }}</slot>
      </p>
    </div>
    <div v-if="$slots.default" class="page-header__actions">
      <slot />
    </div>
  </header>
</template>

<script setup lang="ts">
defineProps<{
  title?: string;
  description?: string;
}>();
</script>

<style scoped lang="scss">
.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 20px;
}

.page-header__text {
  min-width: 0;
  max-width: 720px;
}

.page-header__description {
  margin: 6px 0 0;
  color: var(--ts-ink-2);
  font-size: 0.925rem;
  line-height: 1.5;
}

.page-header__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
