<template>
  <nav class="nav column no-wrap fit" aria-label="Main">
    <div class="col scroll">
      <section v-for="section in sections" :key="section.label" class="nav__section">
        <div class="nav__heading">{{ section.label }}</div>
        <router-link
          v-for="item in section.items"
          :key="item.to"
          v-slot="{ href, navigate, isExactActive }"
          :to="item.to"
          custom
        >
          <a
            :href="href"
            class="nav__item"
            :class="{ 'is-active': isExactActive || isCollectionArea(item, isExactActive) }"
            :aria-current="isExactActive ? 'page' : undefined"
            @click="navigate"
          >
            <q-icon :name="item.icon" size="20px" class="nav__icon" />
            <span class="nav__label">{{ item.label }}</span>
            <span v-if="item.to === '/collections'" class="nav__count">
              {{ collectionsStore.collections.length }}
            </span>
          </a>
        </router-link>
      </section>
    </div>
    <ProjectInfo v-if="!store.uiConfig.hideProjectInfo" />
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useNodeStore } from '@/stores/node';
import { useCollectionsStore } from '@/stores/collections';
import { NAV_SECTIONS } from '@/shared/navigation';
import type { NavItem } from '@/shared/navigation';
import ProjectInfo from './ProjectInfo.vue';

const store = useNodeStore();
const collectionsStore = useCollectionsStore();
const route = useRoute();

const sections = computed(() =>
  NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.available || item.available(store)),
  })).filter((section) => section.items.length),
);

/** Collections stays marked while you are inside one of its collections. */
function isCollectionArea(item: NavItem, isExactActive: boolean) {
  return !isExactActive && item.to === '/collections' && route.path.startsWith('/collection/');
}
</script>

<style scoped lang="scss">
.nav {
  padding: 12px 10px 0;
}

.nav__section + .nav__section {
  margin-top: 18px;
}

.nav__heading {
  padding: 0 10px 6px;
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--ts-ink-3);
  letter-spacing: 0.02em;
}

.nav__item {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 36px;
  padding: 0 10px;
  border-radius: 8px;
  color: var(--ts-ink-2);
  text-decoration: none;
  font-size: 0.9rem;
  transition:
    background 0.12s,
    color 0.12s;

  &:hover {
    background: var(--ts-hover);
    color: var(--ts-ink);
  }

  &.is-active {
    color: var(--ts-ink);
    font-weight: 500;

    .nav__label {
      // The current page is "highlighted", like a hit in a search result.
      background: linear-gradient(
        to bottom,
        transparent 0 38%,
        var(--ts-mark) 38% 94%,
        transparent 94%
      );
      padding: 0 3px;
      margin: 0 -3px;
      border-radius: 2px;
    }

    .nav__icon {
      color: var(--ts-ink);
    }
  }
}

.nav__icon {
  color: var(--ts-ink-3);
}

.nav__label {
  flex: 0 1 auto;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nav__count {
  margin-left: auto;
  font-family: var(--ts-font-mono);
  font-size: 0.72rem;
  color: var(--ts-ink-3);
}
</style>
