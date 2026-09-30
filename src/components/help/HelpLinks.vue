<template>
  <ul class="help-links">
    <li v-for="link in links" :key="docs.url(link)">
      <a
        :href="docs.url(link)"
        target="_blank"
        rel="noopener noreferrer"
        @click="docs.openExternal($event, docs.url(link))"
      >
        <q-icon
          :name="link.kind === 'api' ? 'sym_s_data_object' : 'sym_s_menu_book'"
          size="16px"
          aria-hidden="true"
        />
        <span class="help-links__label">{{ linkLabel(link) }}</span>
        <span class="help-links__kind">{{
          link.kind === 'api' ? `API ${docs.version.value}` : 'Guide'
        }}</span>
        <span class="sr-only">(opens in a new tab)</span>
      </a>
    </li>
  </ul>
</template>

<script setup lang="ts">
import { linkLabel } from '@/shared/help';
import type { DocLink } from '@/shared/help';
import { useDocs } from '@/shared/useDocs';

/** Links to the Typesense docs: the versioned API reference or the Guide. */
defineProps<{ links: DocLink[] }>();

const docs = useDocs();
</script>

<style lang="scss">
.help-links {
  list-style: none;
  margin: 0;
  padding: 0;
  a {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 6px;
    margin: 0 -6px;
    border-radius: 6px;
    font-size: 0.85rem;
    color: var(--ts-primary);
    text-decoration: none;
    &:hover,
    &:focus-visible {
      background: var(--ts-primary-soft);
    }
  }
}

.help-links__label {
  flex: 1;
}

.help-links__kind {
  font-size: 0.7rem;
  color: var(--ts-ink-3);
  white-space: nowrap;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
