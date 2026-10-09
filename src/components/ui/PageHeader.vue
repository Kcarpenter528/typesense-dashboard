<template>
  <header class="page-header">
    <div class="page-header__text">
      <div class="page-header__title-row">
        <h1 class="ts-title">
          <slot name="title">{{ title }}</slot>
        </h1>
        <help-tip v-if="help" :topic="help" size="sm" icon="sym_s_help" class="page-header__help" />
      </div>
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
import HelpTip from '@/components/help/HelpTip.vue';
import type { PageHelpKey } from '@/shared/help';

defineProps<{
  title?: string;
  description?: string;
  /** Shows a help button that explains the page and links to the Typesense docs. */
  help?: PageHelpKey;
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

.page-header__title-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.page-header__help {
  margin-top: 2px;
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
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
</style>
