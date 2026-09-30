<template>
  <q-btn flat round dense icon="sym_s_help" aria-label="Help">
    <q-tooltip>Help</q-tooltip>
    <q-menu
      anchor="bottom right"
      self="top right"
      :offset="[0, 6]"
      class="help-pop"
      max-width="min(380px, calc(100vw - 32px))"
    >
      <div class="help-menu">
        <section v-if="pageHelp" class="help-menu__page">
          <div class="help-menu__eyebrow">This page</div>
          <div class="help-pop__title">{{ pageHelp.title }}</div>
          <p class="help-pop__body">{{ pageHelp.body }}</p>
          <help-links :links="pageHelp.links" />
        </section>
        <q-list dense class="help-menu__list">
          <q-item v-close-popup clickable to="/help">
            <q-item-section avatar><q-icon name="sym_s_school" size="18px" /></q-item-section>
            <q-item-section>
              <q-item-label>Dashboard help</q-item-label>
              <q-item-label caption>Getting started and every page explained</q-item-label>
            </q-item-section>
          </q-item>
          <q-item
            v-for="doc in external"
            :key="doc.url"
            v-close-popup
            clickable
            tag="a"
            :href="doc.url"
            target="_blank"
            rel="noopener noreferrer"
            @click="docs.openExternal($event, doc.url)"
          >
            <q-item-section avatar><q-icon :name="doc.icon" size="18px" /></q-item-section>
            <q-item-section>
              <q-item-label>{{ doc.label }}</q-item-label>
              <q-item-label caption>{{ doc.caption }}</q-item-label>
            </q-item-section>
            <q-item-section side><q-icon name="sym_s_open_in_new" size="16px" /></q-item-section>
          </q-item>
        </q-list>
      </div>
    </q-menu>
  </q-btn>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { GUIDE_URL, PAGE_HELP, docUrl } from '@/shared/help';
import { useDocs } from '@/shared/useDocs';
import HelpLinks from './HelpLinks.vue';

/** The header's help button: help for the current page, then the docs. */
const route = useRoute();
const docs = useDocs();

const pageHelp = computed(() => (route.meta.help ? PAGE_HELP[route.meta.help] : undefined));

const external = computed(() => [
  {
    label: 'Typesense Guide',
    caption: 'How-tos for search, relevance, AI search and operations',
    url: GUIDE_URL,
    icon: 'sym_s_menu_book',
  },
  {
    label: `API reference ${docs.version.value}`,
    caption: 'Every endpoint and parameter for your server version',
    url: docs.apiReference.value,
    icon: 'sym_s_data_object',
  },
  {
    label: 'FAQ',
    caption: 'Common questions and answers',
    url: docUrl({ kind: 'guide', page: 'faqs' }),
    icon: 'sym_s_quiz',
  },
]);
</script>

<style scoped lang="scss">
.help-menu__page {
  padding: 14px 16px 10px;
  border-bottom: 1px solid var(--ts-rule);
}

.help-menu__eyebrow {
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--ts-ink-3);
  margin-bottom: 2px;
}

.help-menu__list {
  padding: 6px 0;
}
</style>
