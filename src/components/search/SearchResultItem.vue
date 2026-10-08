<template>
  <article v-if="currentCollection" class="record">
    <header class="record__header">
      <div class="record__heading">
        <h3 class="record__title">
          <search-result-item-attribute v-if="titleHit" :hit="titleHit" />
          <template v-else>{{ titleText }}</template>
        </h3>
        <code v-if="item?.id !== undefined" class="record__id">{{ item.id }}</code>
      </div>
      <div class="record__actions">
        <q-btn
          flat
          round
          dense
          size="sm"
          icon="sym_s_edit"
          aria-label="Edit document"
          @click="editDocument()"
        >
          <q-tooltip>Edit</q-tooltip>
        </q-btn>
        <q-btn
          flat
          round
          dense
          size="sm"
          icon="sym_s_delete"
          aria-label="Delete document"
          class="ts-danger-hover"
          @click="deleteDocumentById(item?.id)"
        >
          <q-tooltip>Delete</q-tooltip>
        </q-btn>
      </div>
    </header>

    <search-result-item-nested-display
      v-if="item?._highlightResult"
      class="record__body"
      :item="item._highlightResult"
      :include-fields="collectionFields"
      :embed-fields="embedFields"
      :joined-keys="joinedKeys"
      :omit="omitted"
      :limit="expanded ? 0 : VISIBLE_FIELDS"
    />
    <button v-if="hiddenCount > 0 || expanded" type="button" class="record__more" @click="toggle">
      {{ expanded ? 'Show fewer fields' : `Show ${hiddenCount} more fields` }}
    </button>
  </article>
</template>

<script setup lang="ts">
import type { CollectionSchema } from 'typesense/lib/Typesense/Collection';
import { computed, ref } from 'vue';
import { useQuasar } from 'quasar';
import { useCollectionsStore } from '@/stores/collections';
import { useDocumentsStore } from '@/stores/documents';
import SearchResultItemAttribute from './SearchResultItemAttribute.vue';
import SearchResultItemNestedDisplay from './SearchResultItemNestedDisplay.vue';

/** Long documents show this many fields until the card is expanded. */
const VISIBLE_FIELDS = 8;

const props = defineProps<{
  item?: Record<string, any>;
}>();
const emit = defineEmits<(e: 'deleted', id: string) => void>();

const collectionsStore = useCollectionsStore();
const documentsStore = useDocumentsStore();
const $q = useQuasar();
const expanded = ref(false);

const currentCollection = computed((): CollectionSchema | null => {
  return collectionsStore.currentCollection;
});

const collectionFields = computed((): string[] => {
  if (!props.item || !currentCollection.value || !currentCollection.value.fields) return [];
  return currentCollection.value.fields.map((f) => f.name);
});

const embedFields = computed((): string[] => {
  if (!props.item || !currentCollection.value || !currentCollection.value.fields) return [];
  return currentCollection.value.fields.filter((f) => f.embed).map((f) => f.name);
});

/** Top-level keys the schema doesn't know that hold an object: documents joined by reference. */
const joinedKeys = computed((): string[] => {
  const highlight = props.item?._highlightResult;
  if (!highlight) return [];
  const names = collectionFields.value;
  return Object.keys(highlight).filter((key) => {
    const value = highlight[key];
    const known = names.includes(key) || names.some((name) => name.startsWith(`${key}.`));
    const isObject = (v: unknown) => v !== null && typeof v === 'object' && !Array.isArray(v);
    const isLeaf = (v: any) => isObject(v) && 'value' in v && 'matchLevel' in v;
    const holdsDocument = Array.isArray(value)
      ? value.some((v) => isObject(v) && !isLeaf(v))
      : isObject(value) && !isLeaf(value);
    return !known && holdsDocument;
  });
});

/** The first text field names the record; its ID sits beside it. */
const titleField = computed((): string | undefined => {
  const highlight = props.item?._highlightResult;
  if (!highlight) return undefined;
  return collectionFields.value.find((name) => {
    const leaf = highlight[name];
    return name !== 'id' && leaf && typeof leaf.value === 'string' && 'matchLevel' in leaf;
  });
});

const titleHit = computed(() =>
  titleField.value ? props.item?._highlightResult[titleField.value] : undefined,
);

const titleText = computed(() => String(props.item?.id ?? 'Document'));

const omitted = computed(() => ['id', ...(titleField.value ? [titleField.value] : [])]);

const hiddenCount = computed(() => {
  const keys = Object.keys(props.item?._highlightResult ?? {}).filter(
    (key) => !omitted.value.includes(key) && !joinedKeys.value.includes(key),
  );
  return Math.max(0, keys.length - VISIBLE_FIELDS);
});

function toggle() {
  expanded.value = !expanded.value;
}

const editDocument = () => {
  const copyItem: Record<string, any> = {};
  if (!props.item) return;
  Object.keys(props.item).forEach((key) => {
    if (!key.startsWith('_') && !['objectID', 'text_match'].includes(key)) {
      copyItem[key] = props.item?.[key];
    }
  });
  void documentsStore.editDocuments([JSON.parse(JSON.stringify(copyItem))]);
};

const deleteDocumentById = (id: string) => {
  $q.dialog({
    title: 'Confirm',
    message: `Delete document with id: ${id}?`,
    cancel: true,
    persistent: true,
  }).onOk(() => {
    documentsStore
      .deleteDocumentById(id)
      ?.then(() => {
        emit('deleted', id);
      })
      .catch((error: Error) => {
        $q.notify({
          type: 'negative',
          message: `Error deleting document: ${error.message}`,
        });
      });
  });
};
</script>

<style scoped lang="scss">
.record {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.record__header {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px 8px 10px 16px;
  border-bottom: 1px solid var(--ts-rule);
}

.record__heading {
  flex: 1;
  min-width: 0;
}

.record__title {
  margin: 0;
  font-family: var(--ts-font-display);
  font-size: 1.05rem;
  font-weight: 600;
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.record__id {
  display: inline-block;
  margin-top: 2px;
  font-size: 0.72rem;
  color: var(--ts-ink-3);
}

.record__actions {
  display: flex;
  flex: none;
  gap: 2px;
  color: var(--ts-ink-3);
}

.record__body {
  padding: 4px 16px;
}

.record__more {
  margin: 0;
  padding: 10px 16px;
  border: 0;
  border-top: 1px solid var(--ts-rule);
  background: var(--ts-sheet-2);
  color: var(--ts-primary);
  font: inherit;
  font-size: 0.8rem;
  text-align: left;
  cursor: pointer;
  &:hover {
    background: var(--ts-hover);
  }
}
</style>
