<template>
  <q-page class="ts-page">
    <div class="row items-center justify-between q-mb-md">
      <q-btn-toggle
        v-model="tab"
        no-caps
        unelevated
        dense
        toggle-color="primary"
        class="mode-toggle"
        :options="modes"
      />
    </div>

    <q-tab-panels v-model="tab" animated keep-alive class="bg-transparent">
      <q-tab-panel name="form" class="q-pa-none">
        <search-instant-search />
      </q-tab-panel>
      <q-tab-panel name="json" class="q-pa-none">
        <search-json />
      </q-tab-panel>
      <q-tab-panel v-if="aiAvailable" name="ask" class="q-pa-none">
        <search-ask />
      </q-tab-panel>
    </q-tab-panels>
  </q-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useNodeStore } from '@/stores/node';
import SearchJson from '@/components/search/SearchJson.vue';
import SearchInstantSearch from '@/components/search/SearchInstantSearch.vue';
import SearchAsk from '@/components/search/SearchAsk.vue';

const route = useRoute();
const store = useNodeStore();

const aiAvailable = computed(
  () => store.data.features.nlSearchModels || store.data.features.conversationModels,
);
const modes = computed(() => [
  { label: 'Browse', value: 'form', icon: 'sym_s_view_module' },
  { label: 'Query as JSON', value: 'json', icon: 'sym_s_data_object' },
  ...(aiAvailable.value ? [{ label: 'Ask', value: 'ask', icon: 'sym_s_auto_awesome' }] : []),
]);
const tab = ref(route.query.mode === 'ask' ? 'ask' : 'form');
</script>
<style lang="scss">
.mode-toggle {
  border: 1px solid var(--ts-rule);
  border-radius: 8px;
  .q-btn {
    padding: 4px 14px;
  }
}

.ais-Hits-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
  margin: 0;
}

.ais-Hits-item,
.ais-InfiniteHits-item,
.ais-Results-item {
  width: auto !important;
  margin: 0 !important;
  padding: 0 !important;
  display: flex;
  flex-direction: column;
  background: var(--ts-sheet);
  border: 1px solid var(--ts-rule);
  border-radius: 12px;
  box-shadow: none !important;
  overflow: hidden;
  &:hover {
    border-color: var(--ts-rule-strong);
  }
}

.ais-Hits-item .text-body2 [class^='ais-'] {
  font-size: 0.875rem !important;
}
</style>
