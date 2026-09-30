<template>
  <div class="collection-header">
    <div class="ts-page collection-header__inner">
      <nav class="crumbs" aria-label="Breadcrumb">
        <router-link to="/collections">Collections</router-link>
        <q-icon name="sym_s_chevron_right" size="16px" />
      </nav>

      <div class="row items-center no-wrap q-gutter-x-sm">
        <h1 class="ts-title text-mono collection-name">{{ name }}</h1>
        <q-btn
          flat
          round
          dense
          size="sm"
          icon="sym_s_unfold_more"
          aria-label="Switch collection"
          class="collection-switch"
        >
          <q-tooltip>Switch collection</q-tooltip>
          <q-menu :offset="[0, 6]" class="collection-menu">
            <q-list dense style="min-width: 260px">
              <q-item
                v-for="c in otherCollections"
                :key="c.name"
                v-close-popup
                clickable
                @click="switchTo(c.name)"
              >
                <q-item-section class="text-mono">{{ c.name }}</q-item-section>
                <q-item-section side class="text-caption">
                  {{ (c.num_documents ?? 0).toLocaleString() }}
                </q-item-section>
              </q-item>
              <q-item v-if="!otherCollections.length">
                <q-item-section class="ts-faint">No other collections</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
        <q-space />
        <q-btn
          flat
          dense
          no-caps
          icon="sym_s_more_horiz"
          :label="$q.screen.gt.xs ? 'More' : undefined"
          aria-label="More actions"
          class="ts-muted"
        >
          <q-menu anchor="bottom right" self="top right">
            <q-list dense style="min-width: 220px">
              <q-item v-close-popup clickable @click="actions.exportCollection(name)">
                <q-item-section avatar><q-icon name="sym_s_download" size="18px" /></q-item-section>
                <q-item-section>Export documents</q-item-section>
              </q-item>
              <q-item v-close-popup clickable @click="actions.copySchema(name)">
                <q-item-section avatar>
                  <q-icon name="sym_s_content_copy" size="18px" />
                </q-item-section>
                <q-item-section>Copy schema to a new collection</q-item-section>
              </q-item>
              <q-separator />
              <q-item v-close-popup clickable @click="actions.deleteDocuments(name, 'filter')">
                <q-item-section avatar>
                  <q-icon name="sym_s_filter_alt_off" size="18px" />
                </q-item-section>
                <q-item-section>Delete documents by filter…</q-item-section>
              </q-item>
              <q-item v-close-popup clickable @click="actions.deleteDocuments(name, 'all')">
                <q-item-section avatar>
                  <q-icon name="sym_s_delete_sweep" size="18px" />
                </q-item-section>
                <q-item-section>Delete all documents…</q-item-section>
              </q-item>
              <q-item
                v-close-popup
                clickable
                class="text-negative"
                @click="actions.deleteCollection(name)"
              >
                <q-item-section avatar><q-icon name="sym_s_delete" size="18px" /></q-item-section>
                <q-item-section>Delete collection</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
      </div>

      <div v-if="collection" class="facts">
        <span class="fact">
          <strong>{{ (collection.num_documents ?? 0).toLocaleString() }}</strong> documents
        </span>
        <span class="fact"
          ><strong>{{ topLevelFields }}</strong> fields</span
        >
        <span v-if="collection.enable_nested_fields" class="fact">Nested fields on</span>
        <span v-if="aliases.length" class="fact">
          Alias
          <code v-for="a in aliases" :key="a" class="q-ml-xs">{{ a }}</code>
        </span>
        <span v-if="linkedSets" class="fact">{{ linkedSets }}</span>
        <span class="fact ts-faint">Created {{ createdAt }}</span>
      </div>
      <div v-else-if="collectionsStore.collections.length" class="facts">
        <span class="fact">This collection doesn't exist on the server.</span>
      </div>

      <nav class="tabs" aria-label="Collection">
        <router-link
          v-for="tab in tabs"
          :key="tab.to"
          v-slot="{ href, navigate, isActive }"
          :to="tab.to"
          custom
        >
          <a
            :href="href"
            class="tab"
            :class="{ 'is-active': isActive }"
            :aria-current="isActive ? 'page' : undefined"
            @click="navigate"
          >
            <q-icon :name="tab.icon" size="18px" />
            {{ tab.label }}
          </a>
        </router-link>
      </nav>
    </div>
  </div>
  <router-view />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useNodeStore } from '@/stores/node';
import { useAliasesStore } from '@/stores/aliases';
import { useCollectionsStore } from '@/stores/collections';
import { collectionTabs } from '@/shared/navigation';
import { useCollectionActions } from '@/shared/useCollectionActions';

const store = useNodeStore();
const aliasesStore = useAliasesStore();
const collectionsStore = useCollectionsStore();
const route = useRoute();
const router = useRouter();
const actions = useCollectionActions();

const name = computed(() => String(route.params.name ?? ''));
const collection = computed(() => collectionsStore.collections.find((c) => c.name === name.value));
const tabs = computed(() => collectionTabs(store, name.value));

const otherCollections = computed(() =>
  collectionsStore.collections
    .filter((c) => c.name !== name.value)
    .sort((a, b) => a.name.localeCompare(b.name)),
);

// Auto-detected nested sub-fields (e.g. customer.name) are not counted as fields.
const topLevelFields = computed(() => {
  const fields = collection.value?.fields ?? [];
  const objects = fields.filter((f) => f.type === 'object' || f.type === 'object[]');
  return fields.filter((f) => !objects.some((o) => f.name.startsWith(`${o.name}.`))).length;
});

const aliases = computed(() =>
  aliasesStore.aliases.filter((a) => a.collection_name === name.value).map((a) => a.name),
);

const linkedSets = computed(() => {
  const synonyms = collection.value?.synonym_sets?.length ?? 0;
  const curations = collection.value?.curation_sets?.length ?? 0;
  const parts = [];
  if (synonyms) parts.push(`${synonyms} synonym ${synonyms === 1 ? 'set' : 'sets'}`);
  if (curations) parts.push(`${curations} curation ${curations === 1 ? 'set' : 'sets'}`);
  return parts.join(', ');
});

const createdAt = computed(() => {
  const seconds = collection.value?.created_at;
  return seconds ? new Date(seconds * 1000).toLocaleDateString() : '';
});

function switchTo(target: string) {
  const section = route.path.split('/').pop();
  void router.push(`/collection/${encodeURIComponent(target)}/${section}`);
}
</script>

<style scoped lang="scss">
.collection-header {
  background: var(--ts-sheet);
  border-bottom: 1px solid var(--ts-rule);
}

.collection-header__inner {
  padding-bottom: 0;
}

.crumbs {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.8rem;
  margin-bottom: 6px;
  color: var(--ts-ink-3);
  a {
    color: var(--ts-ink-2);
    text-decoration: none;
    &:hover {
      color: var(--ts-primary);
    }
  }
}

.collection-name {
  font-family: var(--ts-font-mono);
  font-weight: 500;
  letter-spacing: -0.02em;
  font-size: 1.6rem;
  word-break: break-all;
}

.collection-switch {
  color: var(--ts-ink-3);
}

.facts {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 20px;
  margin-top: 10px;
  font-size: 0.85rem;
  color: var(--ts-ink-2);
  strong {
    color: var(--ts-ink);
    font-weight: 600;
  }
  code {
    color: var(--ts-ink);
  }
}

.tabs {
  display: flex;
  gap: 4px;
  margin-top: 18px;
  overflow-x: auto;
}

.tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px 12px;
  color: var(--ts-ink-2);
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 500;
  white-space: nowrap;
  border-bottom: 2px solid transparent;
  &:hover {
    color: var(--ts-ink);
  }
  &.is-active {
    color: var(--ts-ink);
    border-bottom-color: var(--ts-primary);
  }
}
</style>
