<template>
  <q-page class="ts-page help-page">
    <page-header
      title="Help"
      description="How to get around this dashboard, what each page does, and where to read more in the Typesense documentation."
    />

    <div class="docs-row">
      <a
        v-for="doc in docCards"
        :key="doc.url"
        class="doc-card ts-sheet"
        :href="doc.url"
        target="_blank"
        rel="noopener noreferrer"
        @click="docs.openExternal($event, doc.url)"
      >
        <q-icon :name="doc.icon" size="22px" class="doc-card__icon" />
        <div class="col">
          <div class="doc-card__title">
            {{ doc.label }} <q-icon name="sym_s_open_in_new" size="14px" />
          </div>
          <div class="doc-card__caption">{{ doc.caption }}</div>
        </div>
      </a>
    </div>

    <section class="q-mt-xl">
      <h2 class="ts-section-title">Getting started</h2>
      <p class="section-lead">The usual path from an empty server to search in your app.</p>
      <ol class="steps">
        <li v-for="step in steps" :key="step.title" class="step">
          <div class="step__text">
            <div class="step__title">{{ step.title }}</div>
            <p class="step__body">{{ step.body }}</p>
            <help-links :links="step.links" class="step__links" />
          </div>
          <q-btn
            v-if="step.to"
            flat
            no-caps
            dense
            color="primary"
            icon-right="sym_s_arrow_forward"
            :label="step.action"
            :to="step.to"
            class="step__action"
          />
        </li>
      </ol>
    </section>

    <section class="q-mt-xl">
      <div class="row items-end q-gutter-md justify-between">
        <div>
          <h2 class="ts-section-title">Every page</h2>
          <p class="section-lead q-mb-none">
            Each page also has a <q-icon name="sym_s_help" size="16px" /> button next to its title,
            and settings have <q-icon name="sym_s_info" size="16px" /> buttons that explain them.
          </p>
        </div>
        <q-input
          v-model="filter"
          dense
          outlined
          clearable
          class="ts-filter"
          placeholder="Find a topic"
          aria-label="Find a topic"
        >
          <template #prepend><q-icon name="sym_s_search" size="18px" /></template>
        </q-input>
      </div>

      <template v-for="section in sections" :key="section.label">
        <h3 class="group-title">{{ section.label }}</h3>
        <div class="topics">
          <article v-for="item in section.items" :key="item.key" class="topic ts-sheet">
            <div class="row items-center no-wrap q-mb-xs">
              <q-icon :name="item.icon" size="20px" class="topic__icon" />
              <div class="topic__title col">{{ item.topic.title }}</div>
              <q-btn
                v-if="item.to"
                flat
                dense
                no-caps
                size="sm"
                color="primary"
                label="Open"
                :to="item.to"
              />
            </div>
            <p class="topic__body">{{ item.topic.body }}</p>
            <help-links :links="item.topic.links" />
          </article>
        </div>
      </template>
      <p v-if="!sections.length" class="ts-faint q-mt-lg">
        Nothing matches “{{ filter }}”. Try the
        <a
          class="ts-link"
          :href="GUIDE_URL"
          target="_blank"
          rel="noopener noreferrer"
          @click="docs.openExternal($event, GUIDE_URL)"
          >Typesense Guide</a
        >.
      </p>
    </section>
  </q-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useNodeStore } from '@/stores/node';
import { useCollectionsStore } from '@/stores/collections';
import { NAV_SECTIONS } from '@/shared/navigation';
import { GUIDE_URL, PAGE_HELP, docUrl } from '@/shared/help';
import type { DocLink, HelpTopic, PageHelpKey } from '@/shared/help';
import { useDocs } from '@/shared/useDocs';
import PageHeader from '@/components/ui/PageHeader.vue';
import HelpLinks from '@/components/help/HelpLinks.vue';

const store = useNodeStore();
const collectionsStore = useCollectionsStore();
const docs = useDocs();
const filter = ref('');

const docCards = computed(() => [
  {
    label: 'Typesense Guide',
    caption: 'How-tos for relevance, AI search, syncing data and running in production',
    url: GUIDE_URL,
    icon: 'sym_s_menu_book',
  },
  {
    label: `API reference ${docs.version.value}`,
    caption: 'Every endpoint and parameter, for the version your server runs',
    url: docs.apiReference.value,
    icon: 'sym_s_data_object',
  },
  {
    label: 'FAQ',
    caption: 'Answers to common questions',
    url: docUrl({ kind: 'guide', page: 'faqs' }),
    icon: 'sym_s_quiz',
  },
  {
    label: 'API errors',
    caption: 'What each HTTP error from the server means',
    url: docs.url({ kind: 'api', page: 'api-errors' }),
    icon: 'sym_s_error',
  },
]);

/** A collection to link the per-collection steps to, when there is one. */
const firstCollection = computed(() => collectionsStore.collections[0]?.name);

const steps = computed<
  { title: string; body: string; to?: string; action?: string; links: DocLink[] }[]
>(() => [
  {
    title: 'Create a collection',
    body: 'Decide which fields to search, filter, facet and sort on. You can add fields later; a few settings are fixed at creation.',
    to: '/collections',
    action: 'Collections',
    links: PAGE_HELP.collections.links,
  },
  {
    title: 'Add documents',
    body: 'Import JSON or JSONL. The import reports every document that does not match the schema.',
    ...(firstCollection.value
      ? { to: `/collection/${firstCollection.value}/document`, action: 'Add documents' }
      : {}),
    links: PAGE_HELP.documents.links,
  },
  {
    title: 'Try searches',
    body: 'Check results, filters and sorting the way your app will use them.',
    ...(firstCollection.value
      ? { to: `/collection/${firstCollection.value}/search`, action: 'Search' }
      : {}),
    links: PAGE_HELP.search.links,
  },
  {
    title: 'Tune relevance',
    body: 'Add synonyms for words your users use, curate important queries, and remove stopwords.',
    to: '/synonyms',
    action: 'Synonyms',
    links: [
      { kind: 'guide', page: 'ranking-and-relevance', label: 'Ranking and relevance' },
      ...PAGE_HELP.curations.links.slice(0, 1),
    ],
  },
  {
    title: 'Give your app its own key',
    body: 'Create a search-only key for the browser and a write key for your backend. Keep the admin key private.',
    to: '/apikeys',
    action: 'API keys',
    links: PAGE_HELP.apiKeys.links,
  },
  {
    title: 'Get ready for production',
    body: 'Set CORS and resource limits, schedule snapshots, and consider a three-node cluster.',
    to: '/settings',
    action: 'Server settings',
    links: [
      { kind: 'guide', page: 'running-in-production', label: 'Running in production' },
      { kind: 'guide', page: 'backups', label: 'Backups' },
      { kind: 'guide', page: 'high-availability', label: 'High availability' },
    ],
  },
]);

interface TopicItem {
  key: string;
  icon: string;
  to?: string;
  topic: HelpTopic;
}

/** Pages inside a collection, which the navigation reaches through the collection. */
const COLLECTION_PAGES: { key: PageHelpKey; icon: string; tab: string }[] = [
  { key: 'schema', icon: 'sym_s_data_object', tab: 'schema' },
  { key: 'documents', icon: 'sym_s_note_add', tab: 'document' },
  { key: 'search', icon: 'sym_s_search', tab: 'search' },
];

const allSections = computed(() =>
  NAV_SECTIONS.map((section) => {
    const items: TopicItem[] = section.items
      .filter((item) => item.help && (!item.available || item.available(store)))
      .map((item) => ({
        key: item.help!,
        icon: item.icon,
        to: item.to,
        topic: PAGE_HELP[item.help!],
      }));
    if (section.label === 'Data') {
      for (const page of COLLECTION_PAGES) {
        items.push({
          key: page.key,
          icon: page.icon,
          ...(firstCollection.value
            ? { to: `/collection/${firstCollection.value}/${page.tab}` }
            : {}),
          topic: { ...PAGE_HELP[page.key], title: `Collection › ${PAGE_HELP[page.key].title}` },
        });
      }
    }
    return { label: section.label, items };
  }).filter((section) => section.items.length),
);

const sections = computed(() => {
  const q = (filter.value ?? '').trim().toLowerCase();
  if (!q) return allSections.value;
  return allSections.value
    .map((section) => ({
      ...section,
      items: section.items.filter((item) =>
        `${item.topic.title} ${item.topic.body}`.toLowerCase().includes(q),
      ),
    }))
    .filter((section) => section.items.length);
});
</script>

<style scoped lang="scss">
.docs-row {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 12px;
}

.doc-card {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 14px 16px;
  color: var(--ts-ink);
  text-decoration: none;
  &:hover,
  &:focus-visible {
    border-color: var(--ts-primary);
  }
}

.doc-card__icon {
  color: var(--ts-primary);
  margin-top: 2px;
}

.doc-card__title {
  font-weight: 600;
}

.doc-card__caption {
  font-size: 0.8rem;
  color: var(--ts-ink-2);
  margin-top: 2px;
}

.section-lead {
  color: var(--ts-ink-2);
  margin: 4px 0 16px;
  max-width: 70ch;
}

.steps {
  list-style: none;
  counter-reset: step;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
}

.step {
  counter-increment: step;
  display: flex;
  gap: 16px;
  align-items: flex-start;
  padding: 14px 16px 10px;
  border: 1px solid var(--ts-rule);
  border-radius: 12px;
  background: var(--ts-sheet);
  &::before {
    content: counter(step);
    flex-shrink: 0;
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--ts-mark);
    color: #1b1b1b;
    font-weight: 700;
    font-size: 0.85rem;
  }
  @media (max-width: 599px) {
    flex-wrap: wrap;
  }
}

.step__text {
  flex: 1;
  min-width: 0;
}

.step__title {
  font-weight: 600;
}

.step__body {
  margin: 2px 0 6px;
  color: var(--ts-ink-2);
  font-size: 0.9rem;
}

.step__links {
  display: flex;
  flex-wrap: wrap;
  column-gap: 20px;
}

.step__action {
  flex-shrink: 0;
}

.group-title {
  margin: 28px 0 10px;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--ts-ink-3);
}

.topics {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
  @media (max-width: 599px) {
    grid-template-columns: minmax(0, 1fr);
  }
}

.topic {
  padding: 14px 16px 10px;
}

.topic__icon {
  color: var(--ts-ink-2);
  margin-right: 8px;
}

.topic__title {
  font-weight: 600;
}

.topic__body {
  font-size: 0.875rem;
  color: var(--ts-ink-2);
  line-height: 1.5;
  margin: 0 0 8px;
}
</style>
