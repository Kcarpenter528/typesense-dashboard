<template>
  <q-btn
    v-if="help"
    flat
    round
    dense
    :size="size"
    :icon="icon"
    class="help-tip"
    :aria-label="`About ${help.title}`"
    @click.stop
  >
    <q-menu
      anchor="bottom middle"
      self="top middle"
      :offset="[0, 6]"
      class="help-pop"
      max-width="min(360px, calc(100vw - 32px))"
    >
      <div class="help-pop__inner" role="dialog" :aria-label="help.title">
        <div class="help-pop__title">{{ help.title }}</div>
        <p class="help-pop__body">{{ help.body }}</p>
        <help-links :links="help.links" class="help-pop__links" />
      </div>
    </q-menu>
  </q-btn>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { resolveTopic } from '@/shared/help';
import type { HelpTopic } from '@/shared/help';
import HelpLinks from './HelpLinks.vue';

/**
 * A small ⓘ button that explains a page or setting and links to the Typesense docs.
 * Opens on click (not hover) so it works with touch and keyboard.
 */
const props = withDefaults(
  defineProps<{
    /** A key from PAGE_HELP or FIELD_HELP, or a topic object. */
    topic: string | HelpTopic;
    size?: string;
    icon?: string;
  }>(),
  { size: 'xs', icon: 'sym_s_info' },
);

const help = computed(() => resolveTopic(props.topic));
</script>

<style lang="scss">
.help-tip {
  color: var(--ts-ink-3);
  &:hover,
  &:focus-visible {
    color: var(--ts-primary);
  }
}

.help-pop {
  background: var(--ts-sheet);
  color: var(--ts-ink);
  border: 1px solid var(--ts-rule);
  border-radius: 10px;
  box-shadow: var(--ts-shadow);
}

.help-pop__inner {
  padding: 14px 16px 10px;
}

.help-pop__title {
  font-family: var(--ts-font-display);
  font-weight: 600;
  font-size: 0.95rem;
}

.help-pop__body {
  margin: 6px 0 10px;
  font-size: 0.85rem;
  line-height: 1.5;
  color: var(--ts-ink-2);
}

.help-pop__links {
  padding-top: 8px;
  border-top: 1px solid var(--ts-rule);
}
</style>
