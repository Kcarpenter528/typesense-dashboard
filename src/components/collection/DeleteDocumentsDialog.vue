<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="delete-docs">
      <q-card-section>
        <div class="row items-center no-wrap">
          <h2 class="ts-section-title">
            {{ mode === 'filter' ? 'Delete matching documents' : `Empty ${collectionName}` }}
          </h2>
          <help-tip
            :topic="mode === 'filter' ? 'documents.filter_by' : 'documents.truncate'"
            size="sm"
            class="q-ml-xs"
          />
        </div>
        <p class="delete-docs__lead">
          <template v-if="mode === 'filter'">
            Permanently deletes every document in <code>{{ collectionName }}</code> that matches a
            filter. The collection and its schema stay.
          </template>
          <template v-else>
            Permanently deletes
            {{ total === 1 ? 'its only document' : `all ${total.toLocaleString()} documents` }}. The
            collection keeps its schema, settings, aliases and linked sets, so you can import fresh
            data into it.
          </template>
        </p>
      </q-card-section>

      <q-card-section class="q-pt-none">
        <template v-if="mode === 'filter'">
          <q-input
            v-model="filter"
            outlined
            autofocus
            label="filter_by"
            placeholder="status:=closed && dueDate:<1790000000"
            input-class="text-mono"
            :error="!!countError"
            :error-message="countError"
            @keydown.enter.prevent="confirm"
          >
          </q-input>
          <div class="delete-docs__examples row items-center">
            <span class="ts-faint">Examples:</span>
            <q-chip
              v-for="example in examples"
              :key="example"
              dense
              clickable
              class="text-mono"
              @click="filter = example"
            >
              {{ example }}
            </q-chip>
          </div>
          <div class="delete-docs__count" aria-live="polite">
            <q-spinner v-if="counting" size="16px" />
            <template v-else-if="matchCount !== null">
              <strong>{{ matchCount.toLocaleString() }}</strong> of
              {{ total.toLocaleString() }} documents match.
            </template>
          </div>
        </template>
        <q-input
          v-else
          v-model="typedName"
          outlined
          autofocus
          :label="`Type ${collectionName} to confirm`"
          input-class="text-mono"
          :error="!!countError"
          :error-message="countError"
          @keydown.enter.prevent="confirm"
        />
      </q-card-section>

      <q-card-actions align="right" class="q-px-md q-pb-md">
        <q-btn v-close-popup flat no-caps label="Cancel" />
        <q-btn
          unelevated
          no-caps
          color="negative"
          :label="confirmLabel"
          :disable="!canConfirm"
          :loading="working"
          @click="confirm"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import HelpTip from '@/components/help/HelpTip.vue';
import { computed, ref, watch } from 'vue';
import { useDialogPluginComponent } from 'quasar';
import { useCollectionsStore } from '@/stores/collections';
import { useDocumentsStore } from '@/stores/documents';
import { serverMessage } from '@/shared/errors';

const props = defineProps<{
  collectionName: string;
  mode: 'filter' | 'all';
}>();

defineEmits([...useDialogPluginComponent.emits]);
const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent();

const collectionsStore = useCollectionsStore();
const documentsStore = useDocumentsStore();

const collection = computed(() =>
  collectionsStore.collections.find((c) => c.name === props.collectionName),
);
const total = computed(() => collection.value?.num_documents ?? 0);

const filter = ref('');
const typedName = ref('');
const matchCount = ref<number | null>(null);
const countError = ref('');
const counting = ref(false);
const working = ref(false);

/** Filter examples built from the collection's own fields. */
const examples = computed(() => {
  const fields = collection.value?.fields ?? [];
  const out: string[] = [];
  const facet = fields.find((f) => f.facet && f.type === 'string');
  if (facet) out.push(`${facet.name}:=some-value`);
  const numeric = fields.find((f) => ['int32', 'int64', 'float'].includes(f.type));
  if (numeric) out.push(`${numeric.name}:<100`);
  out.push('id:[doc-1, doc-2]');
  return out;
});

let countTimer: ReturnType<typeof setTimeout> | undefined;
let countRequest = 0;
watch(filter, (value) => {
  clearTimeout(countTimer);
  matchCount.value = null;
  countError.value = '';
  if (!value.trim()) return;
  countTimer = setTimeout(() => {
    const request = ++countRequest;
    counting.value = true;
    documentsStore
      .countMatching(props.collectionName, value.trim())
      .then((count) => {
        if (request === countRequest) matchCount.value = count;
      })
      .catch((error: Error) => {
        if (request === countRequest) countError.value = serverMessage(error);
      })
      .finally(() => {
        if (request === countRequest) counting.value = false;
      });
  }, 350);
});

const canConfirm = computed(() =>
  props.mode === 'filter'
    ? !!filter.value.trim() && !counting.value && !!matchCount.value
    : typedName.value === props.collectionName,
);

const confirmLabel = computed(() => {
  if (props.mode === 'all') return 'Delete all documents';
  if (!matchCount.value) return 'Delete documents';
  return `Delete ${matchCount.value.toLocaleString()} document${matchCount.value === 1 ? '' : 's'}`;
});

async function confirm() {
  if (!canConfirm.value || working.value) return;
  working.value = true;
  try {
    const deleted =
      props.mode === 'filter'
        ? await documentsStore.deleteByFilter(props.collectionName, filter.value.trim())
        : await documentsStore.truncate(props.collectionName);
    onDialogOK(deleted);
  } catch (error) {
    countError.value = serverMessage(error);
    if (props.mode === 'all') typedName.value = '';
  } finally {
    working.value = false;
  }
}
</script>

<style scoped lang="scss">
.delete-docs {
  width: min(560px, 100vw);
}

.delete-docs__lead {
  margin: 8px 0 0;
  color: var(--ts-ink-2);
}

.delete-docs__examples {
  gap: 4px;
  font-size: 0.8rem;
  margin-top: -4px;
}

.delete-docs__count {
  min-height: 24px;
  margin-top: 10px;
  font-size: 0.9rem;
}
</style>
