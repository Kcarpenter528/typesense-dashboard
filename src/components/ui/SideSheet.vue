<template>
  <q-dialog
    :model-value="modelValue"
    position="right"
    full-height
    :persistent="persistent"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="side-sheet column no-wrap" :style="{ width }" role="dialog" :aria-label="title">
      <header class="side-sheet__header row no-wrap items-start">
        <div class="col">
          <h2 class="ts-section-title">{{ title }}</h2>
          <p v-if="description" class="side-sheet__description">{{ description }}</p>
        </div>
        <q-btn v-close-popup flat round dense icon="sym_s_close" aria-label="Close" />
      </header>
      <div class="side-sheet__body col scroll">
        <slot />
      </div>
      <footer v-if="$slots.actions" class="side-sheet__footer row no-wrap items-center justify-end">
        <slot name="actions" />
      </footer>
    </div>
  </q-dialog>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue: boolean;
    title: string;
    description?: string;
    width?: string;
    persistent?: boolean;
  }>(),
  { width: 'min(520px, 100vw)', description: '', persistent: false },
);

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();
</script>

<style scoped lang="scss">
.side-sheet {
  height: 100%;
  max-width: 100vw;
  background: var(--ts-sheet);
  color: var(--ts-ink);
  border-left: 1px solid var(--ts-rule);
  box-shadow: var(--ts-shadow);
}

.side-sheet__header {
  gap: 12px;
  padding: 20px 20px 16px 24px;
  border-bottom: 1px solid var(--ts-rule);
}

.side-sheet__description {
  margin: 4px 0 0;
  font-size: 0.875rem;
  color: var(--ts-ink-2);
}

.side-sheet__body {
  padding: 20px 24px;
}

.side-sheet__footer {
  gap: 8px;
  padding: 14px 24px;
  border-top: 1px solid var(--ts-rule);
  background: var(--ts-sheet-2);
}
</style>
