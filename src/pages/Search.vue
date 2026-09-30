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
        :options="[
          { label: 'Browse', value: 'form', icon: 'sym_s_view_module' },
          { label: 'Query as JSON', value: 'json', icon: 'sym_s_data_object' },
        ]"
      />
    </div>

    <q-tab-panels v-model="tab" animated keep-alive class="bg-transparent">
      <q-tab-panel name="form" class="q-pa-none">
        <search-instant-search />
      </q-tab-panel>
      <q-tab-panel name="json" class="q-pa-none">
        <search-json />
      </q-tab-panel>
    </q-tab-panels>
  </q-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import SearchJson from '@/components/search/SearchJson.vue';
import SearchInstantSearch from '@/components/search/SearchInstantSearch.vue';

const tab = ref('form');
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
