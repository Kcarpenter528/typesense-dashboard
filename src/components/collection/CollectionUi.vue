<template>
  <q-card flat bordered class="collection-ui">
    <div class="collection-ui__mode row items-center justify-between">
      <q-btn-toggle
        v-model="tab"
        no-caps
        unelevated
        dense
        toggle-color="primary"
        class="mode-toggle"
        :options="[
          { label: 'Form', value: 'form' },
          { label: 'JSON', value: 'json' },
        ]"
      />
      <span class="ts-faint text-caption">{{ schema.fields.length }} fields</span>
    </div>

    <q-separator />

    <q-tab-panels v-model="tab" animated class="collection-ui__panels">
      <q-tab-panel name="form">
        <q-card-section>
          <div class="row q-gutter-md">
            <q-input
              v-model="schema.name"
              class="col"
              outlined
              dense
              label="Collection name"
              placeholder="books"
              :disable="!createMode"
              :rules="[(val) => !!val || 'Enter a name']"
            />
            <q-select
              v-model="schema.default_sorting_field"
              outlined
              class="col"
              dense
              :options="availableSortFields"
              label="Default sort field"
              hint="Optional. A numeric field used when a search doesn't sort."
            >
            </q-select>
          </div>
          <div class="row q-gutter-md items-start q-pt-sm">
            <q-toggle
              v-model="schema.enable_nested_fields"
              class="col-12 col-md-auto"
              label="Enable nested fields (object / object[])"
            />
            <q-select
              v-model="schema.token_separators"
              class="col"
              outlined
              dense
              multiple
              use-chips
              use-input
              hide-dropdown-icon
              new-value-mode="add-unique"
              input-debounce="0"
              label="Token separators"
              hint="Characters that split words, e.g. - or /"
            />
            <q-select
              v-model="schema.symbols_to_index"
              class="col"
              outlined
              dense
              multiple
              use-chips
              use-input
              hide-dropdown-icon
              new-value-mode="add-unique"
              input-debounce="0"
              label="Symbols to index"
              hint="Special characters to keep, e.g. + or #"
            />
          </div>
          <div v-if="!createMode" class="text-caption text-grey-7 q-pt-md">
            <q-icon name="sym_s_lock" /> Default sort field, nested fields, token separators and
            symbols to index can only be set when a collection is created. Changing them recreates
            the collection; its documents are kept.
          </div>
          <q-expansion-item
            v-model="metadataOpen"
            dense
            switch-toggle-side
            class="q-mt-md"
            header-class="text-grey-8 q-px-none"
            label="Metadata"
            :caption="metadataCaption"
          >
            <q-input
              v-model="metadataText"
              type="textarea"
              outlined
              autogrow
              class="metadata-input q-mt-sm"
              placeholder='{ "owner": "search-team" }'
              hint="Any JSON object. Stored with the collection and can be changed at any time."
              :error="!!metadataError"
              :error-message="metadataError ?? undefined"
            />
          </q-expansion-item>
          <div class="text-subtitle1 q-pt-md">Fields</div>
          <field-editor
            v-for="field in schema.fields"
            :key="fieldKey(field)"
            :model-value="field"
            :siblings="schema.fields"
            :reference-options="referenceOptions"
            :stemming-dictionary-options="stemmingDictionaryOptions"
            @remove="removeField(field)"
          />
        </q-card-section>
      </q-tab-panel>

      <q-tab-panel name="json" class="q-pa-none">
        <monaco-editor v-model="schemaJson" style="height: 60vh" />
        <div v-if="jsonError" class="json-error">This isn't valid JSON yet: {{ jsonError }}</div>
      </q-tab-panel>
    </q-tab-panels>
    <div class="collection-ui__actions row items-center justify-between">
      <q-btn flat no-caps icon="sym_s_add" label="Add field" @click="addField()" />
      <q-btn
        unelevated
        no-caps
        color="primary"
        :label="primaryActionLabel"
        @click="emit('submit', schema)"
      />
    </div>
  </q-card>
</template>

<script setup lang="ts">
import type { CollectionFieldSchema, CollectionSchema } from 'typesense/lib/Typesense/Collection';
import type { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';
import { computed, ref, watch } from 'vue';
import type { PropType } from 'vue';
import { useCollectionsStore } from '@/stores/collections';
import { useStemmingStore } from '@/stores/stemming';
import MonacoEditor from '../MonacoEditor.vue';
import FieldEditor from './FieldEditor.vue';
import { isObjectType } from '@/shared/schemaDiff';

interface Props {
  initialSchema?: CollectionCreateSchema | CollectionSchema;
  primaryActionLabel: string;
  createMode?: boolean;
}

const props = defineProps({
  initialSchema: {
    type: Object as PropType<Props['initialSchema']>,
    default: undefined,
  },
  primaryActionLabel: {
    type: String,
    required: true,
  },
  createMode: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits<{
  submit: [schema: CollectionCreateSchema];
}>();

const collectionsStore = useCollectionsStore();
const stemmingStore = useStemmingStore();
const tab = ref<'form' | 'json'>('form');
const schema = ref<CollectionCreateSchema>(createDefaultSchema());
const jsonError = ref<string | null>(null);

const availableSortFields = computed(() => {
  const compatibleFields = schema.value.fields.filter(
    (field) =>
      ['int32', 'int64', 'float'].includes(field.type) || (field.type === 'string' && field.sort),
  );
  return [''].concat(compatibleFields.map((field) => field.name));
});

/** `collection.field` targets for reference fields, from the other collections on the server. */
const referenceOptions = computed(() =>
  collectionsStore.collections
    .filter((c) => c.name !== schema.value.name)
    .flatMap((c) => [
      `${c.name}.id`,
      ...(c.fields ?? [])
        .filter((f) => f.name !== 'id' && !isObjectType(f.type) && !f.name.includes('*'))
        .map((f) => `${c.name}.${f.name}`),
    ]),
);

const metadataText = ref('');
const metadataError = ref<string | null>(null);
const metadataOpen = ref(false);
const metadataCaption = computed(() => {
  const keys = Object.keys(schema.value.metadata ?? {});
  return keys.length ? keys.join(', ') : 'None';
});

watch(metadataText, (text) => {
  if (!text.trim()) {
    schema.value.metadata = {};
    metadataError.value = null;
    return;
  }
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      metadataError.value = 'Metadata must be a JSON object';
      return;
    }
    schema.value.metadata = parsed;
    metadataError.value = null;
  } catch (error) {
    metadataError.value = (error as Error).message;
  }
});

function syncMetadataText() {
  const metadata = schema.value.metadata;
  metadataText.value =
    metadata && Object.keys(metadata).length ? JSON.stringify(metadata, null, 2) : '';
  metadataError.value = null;
}

const stemmingDictionaryOptions = computed(() => {
  return ['default'].concat(stemmingStore.dictionaries || []);
});

const schemaJson = computed({
  get: () => JSON.stringify(schema.value, null, 2),
  set: (json: string) => {
    try {
      schema.value = JSON.parse(json);
      jsonError.value = null;
      syncMetadataText();
    } catch (error) {
      jsonError.value = (error as Error).message;
    }
  },
});

watch(
  () => props.initialSchema,
  (initialSchema) => {
    schema.value = cloneSchema(initialSchema ?? createDefaultSchema());
    syncMetadataText();
    metadataOpen.value = metadataText.value !== '';
  },
  { immediate: true },
);

// Stable keys per field object, so editor state (e.g. expanded sections) follows the
// field when the list is reordered or reloaded, and renaming a field does not remount it.
const fieldKeys = new WeakMap<CollectionFieldSchema, number>();
let nextFieldKey = 0;
function fieldKey(field: CollectionFieldSchema) {
  let key = fieldKeys.get(field);
  if (key === undefined) {
    key = nextFieldKey++;
    fieldKeys.set(field, key);
  }
  return key;
}

function createEmptyField(): CollectionFieldSchema {
  return {
    name: '',
    type: 'string',
    facet: false,
    optional: false,
    index: true,
  };
}

function createDefaultSchema(): CollectionCreateSchema {
  return {
    name: '',
    fields: [createEmptyField()],
    default_sorting_field: '',
    token_separators: [],
    symbols_to_index: [],
    enable_nested_fields: false,
  };
}

function cloneSchema(
  schemaToClone: CollectionCreateSchema | CollectionSchema,
): CollectionCreateSchema {
  return JSON.parse(JSON.stringify(schemaToClone));
}

function addField() {
  schema.value.fields.push(createEmptyField());
}

function removeField(field: CollectionFieldSchema) {
  const index = schema.value.fields.indexOf(field);
  if (index > -1) schema.value.fields.splice(index, 1);
}
</script>

<style scoped lang="scss">
.collection-ui {
  overflow: visible;
}

.collection-ui__mode {
  padding: 10px 14px;
}

.mode-toggle {
  border: 1px solid var(--ts-rule);
  border-radius: 8px;
  :deep(.q-btn) {
    padding: 2px 14px;
  }
}

.collection-ui__panels {
  background: transparent;
}

.json-error {
  padding: 8px 14px;
  font-size: 0.85rem;
  color: var(--q-negative);
  background: var(--ts-danger-soft);
}

// Keeps "Add field" and the save button in reach on long schemas.
.collection-ui__actions {
  position: sticky;
  bottom: 0;
  z-index: 2;
  padding: 10px 14px;
  background: var(--ts-sheet);
  border-top: 1px solid var(--ts-rule);
  border-radius: 0 0 12px 12px;
}
</style>
