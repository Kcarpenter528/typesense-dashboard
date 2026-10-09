<template>
  <div class="request">
    <q-tabs
      v-model="tab"
      dense
      no-caps
      align="left"
      active-color="primary"
      indicator-color="primary"
      class="request__tabs"
    >
      <q-tab v-for="t in tabs" :key="t.name" :name="t.name" :label="t.label" />
    </q-tabs>
    <q-separator />
    <div class="request__bar">
      <span class="ts-muted text-caption">{{ current.note }}</span>
      <q-btn flat dense no-caps size="sm" icon="sym_s_content_copy" label="Copy" @click="copy" />
    </div>
    <pre class="request__code text-mono">{{ current.code }}</pre>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { copyToClipboard, useQuasar } from 'quasar';
import { describeRequest, toCurl, toInstantSearchAdapter, toTypesenseJs } from '@/shared/searchLab';
import type { LabRequest, NodeInfo } from '@/shared/searchLab';

const props = defineProps<{ request: LabRequest; node: NodeInfo }>();
const $q = useQuasar();
const tab = ref('http');

const tabs = [
  { name: 'http', label: 'HTTP' },
  { name: 'curl', label: 'curl' },
  { name: 'js', label: 'typesense-js' },
  { name: 'adapter', label: 'InstantSearch' },
];

const current = computed(() => {
  switch (tab.value) {
    case 'curl':
      return {
        note: 'Replace SEARCH_ONLY_API_KEY with a key that can only search.',
        code: toCurl(props.request, props.node),
      };
    case 'js':
      return {
        note: 'The same request through the official JavaScript client.',
        code: toTypesenseJs(props.request, props.node),
      };
    case 'adapter':
      return {
        note: 'For typesense-instantsearch-adapter. The search box supplies q.',
        code: toInstantSearchAdapter(props.request, props.node),
      };
    default: {
      const { method, path, body } = describeRequest(props.request);
      return {
        note: 'What the dashboard sends. Shared settings go in the URL, each collection in the body.',
        code: `${method} ${path}\n\n${JSON.stringify(body, null, 2)}`,
      };
    }
  }
});

async function copy() {
  try {
    await copyToClipboard(current.value.code);
    $q.notify({ type: 'positive', message: 'Copied', position: 'top', timeout: 1200 });
  } catch {
    $q.notify({ type: 'negative', message: 'Could not copy. Select the text instead.' });
  }
}
</script>

<style scoped lang="scss">
.request__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 0;
}

.request__code {
  margin: 0;
  padding: 14px;
  max-height: calc(100vh - 220px);
  overflow: auto;
  border: 1px solid var(--ts-rule);
  border-radius: 8px;
  background: var(--ts-sheet-2);
  font-size: 0.78rem;
  line-height: 1.5;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
