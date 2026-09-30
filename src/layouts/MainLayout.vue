<template>
  <q-layout view="hHh Lpr lFf">
    <q-header class="app-header">
      <div class="app-header__bar row no-wrap items-center">
        <q-btn
          class="lt-md q-mr-xs"
          flat
          dense
          round
          icon="sym_s_menu"
          aria-label="Open navigation"
          @click="leftDrawerOpen = !leftDrawerOpen"
        />
        <router-link to="/" class="brand row no-wrap items-center" aria-label="Server status">
          <span class="brand__mark" aria-hidden="true">T</span>
          <span class="brand__name">Typesense <mark>Dashboard</mark></span>
        </router-link>

        <button type="button" class="jump-trigger" @click="paletteOpen = true">
          <q-icon name="sym_s_search" size="18px" />
          <span class="jump-trigger__label">Jump to a page or collection</span>
          <kbd class="gt-xs">{{ shortcutLabel }}</kbd>
        </button>

        <q-space />

        <q-btn flat no-caps class="server-chip" :aria-label="`Server ${serverLabel}`">
          <span class="server-chip__dot" :class="healthClass" aria-hidden="true" />
          <span class="server-chip__host text-mono">{{ serverLabel }}</span>
          <span v-if="version" class="server-chip__version gt-sm">v{{ version }}</span>
          <q-icon name="sym_s_expand_more" size="18px" />
          <q-menu anchor="bottom right" self="top right" :offset="[0, 6]">
            <server-history :show-logout="true" />
          </q-menu>
        </q-btn>
        <q-btn
          flat
          round
          dense
          class="q-ml-xs"
          :icon="$q.dark.isActive ? 'sym_s_light_mode' : 'sym_s_dark_mode'"
          :aria-label="$q.dark.isActive ? 'Use light theme' : 'Use dark theme'"
          @click="$q.dark.toggle()"
        >
          <q-tooltip>{{ $q.dark.isActive ? 'Use light theme' : 'Use dark theme' }}</q-tooltip>
        </q-btn>
      </div>
    </q-header>

    <q-drawer
      v-model="leftDrawerOpen"
      show-if-above
      side="left"
      :width="248"
      :breakpoint="1023"
      class="app-drawer"
    >
      <nav-menu />
    </q-drawer>

    <q-page-container>
      <div v-if="store.error" class="error-banner" role="alert">
        <q-icon name="sym_s_error" size="20px" />
        <div class="col">{{ store.error }}</div>
        <q-btn flat dense no-caps label="Dismiss" @click="store.setError(null)" />
      </div>
      <router-view />
    </q-page-container>

    <jump-palette v-model="paletteOpen" />
  </q-layout>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { Platform } from 'quasar';
import NavMenu from '@/components/NavMenu.vue';
import ServerHistory from '@/components/ServerHistory.vue';
import JumpPalette from '@/components/JumpPalette.vue';
import { useNodeStore } from '@/stores/node';

const store = useNodeStore();
const leftDrawerOpen = ref(false);
const paletteOpen = ref(false);

const shortcutLabel = Platform.is.mac ? '⌘K' : 'Ctrl K';

const serverLabel = computed(() => {
  const node = store.loginData?.node;
  return node ? `${node.host}:${node.port}` : '';
});
const version = computed(() => store.data.debug?.version as string | undefined);
const healthClass = computed(() => {
  if (!store.data.features.health) return 'is-unknown';
  return store.data.health?.ok ? 'is-ok' : 'is-bad';
});

function onKeydown(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    paletteOpen.value = !paletteOpen.value;
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown);
  store.refreshServerStatus();
});
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));
</script>

<style scoped lang="scss">
.app-header {
  background: var(--ts-sheet);
  color: var(--ts-ink);
  border-bottom: 1px solid var(--ts-rule);
}

.app-header__bar {
  height: 56px;
  padding: 0 12px 0 16px;
  gap: 8px;
}

.brand {
  gap: 10px;
  color: var(--ts-ink);
  text-decoration: none;
  width: 224px;
  flex-shrink: 0;
  @media (max-width: 1023px) {
    width: auto;
  }
}

.brand__mark {
  display: inline-grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 7px;
  background: var(--ts-ink);
  color: var(--ts-paper);
  font-family: var(--ts-font-display);
  font-weight: 700;
  font-size: 16px;
  box-shadow: inset 0 -7px 0 var(--ts-mark);
}

.brand__name {
  font-family: var(--ts-font-display);
  font-weight: 650;
  font-size: 1rem;
  letter-spacing: -0.01em;
  @media (max-width: 599px) {
    display: none;
  }
}

.jump-trigger {
  display: flex;
  align-items: center;
  gap: 10px;
  width: min(440px, 40vw);
  height: 36px;
  padding: 0 8px 0 12px;
  border: 1px solid var(--ts-rule);
  border-radius: 10px;
  background: var(--ts-paper);
  color: var(--ts-ink-3);
  font: inherit;
  font-size: 0.875rem;
  cursor: pointer;
  transition: border-color 0.15s;
  &:hover {
    border-color: var(--ts-rule-strong);
    color: var(--ts-ink-2);
  }
  @media (max-width: 599px) {
    width: 36px;
    padding: 0;
    justify-content: center;
  }
}

.jump-trigger__label {
  flex: 1;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  @media (max-width: 599px) {
    display: none;
  }
}

kbd {
  font-family: var(--ts-font-mono);
  font-size: 0.7rem;
  padding: 2px 6px;
  border: 1px solid var(--ts-rule);
  border-radius: 5px;
  background: var(--ts-sheet);
  color: var(--ts-ink-3);
}

.server-chip {
  padding: 4px 10px;
  border-radius: 10px;
  color: var(--ts-ink-2);
  :deep(.q-btn__content) {
    gap: 8px;
    flex-wrap: nowrap;
  }
}

.server-chip__host {
  font-size: 0.8rem;
  color: var(--ts-ink);
}

.server-chip__version {
  font-size: 0.75rem;
  color: var(--ts-ink-3);
}

.server-chip__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ts-ink-3);
  &.is-ok {
    background: var(--q-positive);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--q-positive) 22%, transparent);
  }
  &.is-bad {
    background: var(--q-negative);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--q-negative) 22%, transparent);
  }
}

.error-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 16px 32px 0;
  padding: 10px 12px 10px 16px;
  border-radius: 10px;
  background: var(--ts-danger-soft);
  border: 1px solid rgba(200, 50, 75, 0.3);
  color: var(--ts-ink);
  font-size: 0.875rem;
  .q-icon {
    color: var(--q-negative);
  }
  @media (max-width: 599px) {
    margin: 12px 16px 0;
  }
}
</style>

<style lang="scss">
.q-drawer.app-drawer {
  background: var(--ts-sheet);
  border-right: 1px solid var(--ts-rule);
}
</style>
