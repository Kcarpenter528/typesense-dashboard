<template>
  <q-card flat bordered class="field-editor q-mb-md">
    <q-card-section class="row q-col-gutter-sm items-start q-pb-none">
      <q-input
        v-model="field.name"
        class="col-12 col-sm-6"
        dense
        outlined
        label="Field name"
        placeholder="title"
        :hint="nestedParentHint"
        :rules="[(val) => !!val || 'Field name is required']"
      >
        <template #append>
          <help-tip topic="field.name" />
        </template>
      </q-input>
      <q-select
        :model-value="field.type"
        class="col-10 col-sm-5"
        dense
        outlined
        label="Type"
        :options="FIELD_TYPE_OPTIONS"
        emit-value
        map-options
        :rules="[(val) => !!val || 'Type is required']"
        @update:model-value="changeType"
      >
        <template #append>
          <help-tip topic="field.type" />
        </template>
        <template #option="scope">
          <q-item v-bind="scope.itemProps">
            <q-item-section>
              <q-item-label>{{ scope.opt.label }}</q-item-label>
              <q-item-label caption>{{ scope.opt.description }}</q-item-label>
            </q-item-section>
          </q-item>
        </template>
      </q-select>
      <div class="col-2 col-sm-1 text-right">
        <q-btn
          flat
          round
          dense
          icon="sym_s_delete"
          aria-label="Remove field"
          @click="emit('remove')"
        >
          <q-tooltip>Remove field</q-tooltip>
        </q-btn>
      </div>
    </q-card-section>

    <q-card-section class="row items-center q-py-xs">
      <span
        v-for="flag in availableFlags"
        :key="flag.key"
        class="flag row inline no-wrap items-center q-mr-md q-my-xs"
      >
        <q-checkbox
          dense
          :model-value="flagValue(flag.key)"
          :label="flag.label"
          @update:model-value="setFlag(flag.key, $event)"
        />
        <help-tip :topic="`field.${flag.key}`" />
      </span>
      <q-select
        v-if="field.stem"
        :model-value="field.stem_dictionary || 'default'"
        :options="stemmingDictionaryOptions"
        dense
        outlined
        label="Stemming dictionary"
        class="q-my-xs"
        style="min-width: 200px"
        @update:model-value="field.stem_dictionary = $event === 'default' ? '' : $event"
      >
        <template #append>
          <help-tip topic="field.stem_dictionary" />
        </template>
      </q-select>
    </q-card-section>

    <q-expansion-item
      v-if="hasAdvancedOptions"
      v-model="advancedOpen"
      dense
      switch-toggle-side
      expand-separator
      header-class="text-grey-8"
      :label="advancedLabel"
      :caption="advancedSummary"
    >
      <q-card-section class="q-pt-sm">
        <template v-if="supportsTextOptions(field.type)">
          <div class="text-overline text-grey-7">Text</div>
          <div class="row q-col-gutter-sm q-mb-md">
            <q-input
              v-model="field.locale"
              class="col-6 col-md-3"
              dense
              outlined
              label="Locale"
              placeholder="en"
              hint="ISO 639-1 code, e.g. fr, ja, th"
            >
              <template #append>
                <help-tip topic="field.locale" />
              </template>
            </q-input>
            <q-input
              :model-value="field.truncate_len"
              class="col-6 col-md-3"
              dense
              outlined
              type="number"
              label="Truncate length"
              placeholder="100"
              hint="Characters indexed per word"
              @update:model-value="setNumber('truncate_len', $event)"
            >
              <template #append>
                <help-tip topic="field.truncate_len" />
              </template>
            </q-input>
            <q-select
              v-model="field.token_separators"
              class="col-12 col-md-3"
              v-bind="chipInputProps"
              label="Token separators"
              hint="Split words on these, for this field"
            >
              <template #append>
                <help-tip topic="field.token_separators" />
              </template>
            </q-select>
            <q-select
              v-model="field.symbols_to_index"
              class="col-12 col-md-3"
              v-bind="chipInputProps"
              label="Symbols to index"
              hint="Keep these characters, for this field"
            >
              <template #append>
                <help-tip topic="field.symbols_to_index" />
              </template>
            </q-select>
          </div>
        </template>

        <template v-if="supportsReference(field.type)">
          <div class="text-overline text-grey-7">Reference (join)</div>
          <div class="row q-col-gutter-sm items-start q-mb-md">
            <q-select
              :model-value="field.reference || null"
              class="col-12 col-md-6"
              dense
              outlined
              clearable
              use-input
              hide-selected
              fill-input
              input-debounce="0"
              new-value-mode="add-unique"
              label="References"
              placeholder="collection.field"
              hint="Links each document to a document in another collection"
              :options="filteredReferenceOptions"
              :rules="[(val) => isValidReference(val) || 'Use the format collection.field']"
              @filter="filterReferences"
              @input-value="(val: string) => setReference(val)"
              @update:model-value="setReference"
            >
              <template #append>
                <help-tip topic="field.reference" />
              </template>
            </q-select>
            <template v-if="field.reference">
              <div class="col-12 col-md-3 row no-wrap items-center">
                <q-checkbox
                  :model-value="field.async_reference === true"
                  label="Async reference"
                  @update:model-value="field.async_reference = $event"
                />
                <help-tip topic="field.async_reference" />
              </div>
              <div class="col-12 col-md-3 row no-wrap items-center">
                <q-checkbox
                  :model-value="field.cascade_delete !== false"
                  label="Cascade delete"
                  :disable="!field.async_reference && field.cascade_delete !== false"
                  @update:model-value="field.cascade_delete = $event"
                />
                <help-tip topic="field.cascade_delete" />
              </div>
            </template>
          </div>
        </template>

        <template v-if="field.type === 'float[]'">
          <div class="text-overline text-grey-7">
            Vector <help-tip :topic="mode === 'embed' ? 'field.embed' : 'field.num_dim'" />
          </div>
          <q-btn-toggle
            :model-value="mode"
            class="q-mb-md"
            no-caps
            unelevated
            toggle-color="primary"
            :options="[
              { label: 'List of floats', value: 'array' },
              { label: 'Vector', value: 'vector' },
              { label: 'Auto-embedding', value: 'embed' },
            ]"
            @update:model-value="setVectorMode(field, $event)"
          />

          <div v-if="embed" class="row q-col-gutter-sm q-mb-sm">
            <q-select
              v-model="embed.from"
              class="col-12 col-md-6"
              dense
              outlined
              multiple
              use-chips
              label="Embed from fields"
              :options="embedSourceOptions"
              hint="string, string[] or image fields"
            >
              <template #append>
                <help-tip topic="field.embed" />
              </template>
            </q-select>
            <q-select
              v-model="embed.model_config.model_name"
              class="col-12 col-md-6"
              dense
              outlined
              use-input
              hide-selected
              fill-input
              input-debounce="0"
              new-value-mode="add-unique"
              label="Model"
              :options="BUILT_IN_EMBEDDING_MODELS"
              hint="ts/… runs on the server; openai/…, google/…, gcp/… or azure/… are remote"
              @input-value="(val: string) => embed && (embed.model_config.model_name = val)"
            />
            <template v-if="isRemoteModel">
              <q-input
                v-model="embed.model_config.api_key"
                class="col-12 col-md-6"
                dense
                outlined
                type="password"
                autocomplete="off"
                label="API key"
                hint="Stored in the collection schema on the server"
              />
              <q-input
                v-model="embed.model_config.url"
                class="col-12 col-md-6"
                dense
                outlined
                label="Custom URL"
                hint="Optional, for OpenAI-compatible endpoints"
              />
            </template>
            <q-input
              v-model="embed.model_config.indexing_prefix"
              class="col-12 col-md-6"
              dense
              outlined
              label="Indexing prefix"
              hint="Optional, e.g. passage:"
            />
            <q-input
              v-model="embed.model_config.query_prefix"
              class="col-12 col-md-6"
              dense
              outlined
              label="Query prefix"
              hint="Optional, e.g. query:"
            />
          </div>

          <div v-if="mode !== 'array'" class="row q-col-gutter-sm">
            <q-input
              v-if="mode === 'vector'"
              :model-value="field.num_dim"
              class="col-6 col-md-3"
              dense
              outlined
              type="number"
              label="Dimensions"
              :rules="[(val) => Number(val) > 0 || 'Required for vectors']"
              @update:model-value="setNumber('num_dim', $event)"
            >
              <template #append>
                <help-tip topic="field.num_dim" />
              </template>
            </q-input>
            <q-select
              :model-value="field.vec_dist || 'cosine'"
              class="col-6 col-md-3"
              dense
              outlined
              label="Distance"
              :options="VECTOR_DISTANCES"
              @update:model-value="field.vec_dist = $event"
            >
              <template #append>
                <help-tip topic="field.vec_dist" />
              </template>
            </q-select>
            <q-input
              :model-value="hnsw.M"
              class="col-6 col-md-3"
              dense
              outlined
              type="number"
              label="HNSW M"
              placeholder="16"
              hint="Connections per node"
              @update:model-value="setHnsw('M', $event)"
            >
              <template #append>
                <help-tip topic="field.hnsw" />
              </template>
            </q-input>
            <q-input
              :model-value="hnsw.ef_construction"
              class="col-6 col-md-3"
              dense
              outlined
              type="number"
              label="HNSW ef_construction"
              placeholder="200"
              hint="Build-time accuracy"
              @update:model-value="setHnsw('ef_construction', $event)"
            />
          </div>
        </template>
      </q-card-section>
    </q-expansion-item>
  </q-card>
</template>

<script setup lang="ts">
import HelpTip from '@/components/help/HelpTip.vue';
import { computed, ref } from 'vue';
import type { CollectionFieldSchema } from 'typesense/lib/Typesense/Collection';
import {
  applyTypeConstraints,
  BUILT_IN_EMBEDDING_MODELS,
  canBeEmbedSource,
  FIELD_TYPE_OPTIONS,
  isValidReference,
  setVectorMode,
  SORTABLE_BY_DEFAULT_TYPES,
  supportsFacet,
  supportsRangeIndex,
  supportsReference,
  supportsSort,
  supportsStem,
  supportsTextOptions,
  VECTOR_DISTANCES,
  vectorMode,
} from '@/shared/fieldOptions';
import { isObjectType } from '@/shared/schemaDiff';

interface EmbedConfig {
  from: string[];
  model_config: {
    model_name: string;
    api_key?: string;
    url?: string;
    indexing_prefix?: string;
    query_prefix?: string;
    [key: string]: unknown;
  };
}

/** The field options the editor works with, typed (the Typesense types declare most as unknown). */
type EditableField = CollectionFieldSchema & {
  truncate_len?: number;
  token_separators?: string[];
  symbols_to_index?: string[];
  stem_dictionary?: string;
  reference?: string;
  async_reference?: boolean;
  cascade_delete?: boolean;
  vec_dist?: string;
  hnsw_params?: { M?: number; ef_construction?: number };
  embed?: EmbedConfig;
};

type FlagKey = 'optional' | 'index' | 'store' | 'facet' | 'sort' | 'infix' | 'stem' | 'range_index';

interface Flag {
  key: FlagKey;
  label: string;
}

const field = defineModel<EditableField>({ required: true });

const props = defineProps<{
  /** All fields of the collection, including this one. */
  siblings: CollectionFieldSchema[];
  referenceOptions: string[];
  stemmingDictionaryOptions: string[];
}>();

const emit = defineEmits<{ remove: [] }>();

/** Help for each flag is in FIELD_HELP under `field.<key>`. */
const FLAGS: Flag[] = [
  { key: 'optional', label: 'Optional' },
  { key: 'index', label: 'Index' },
  { key: 'store', label: 'Store' },
  { key: 'facet', label: 'Facet' },
  { key: 'sort', label: 'Sort' },
  { key: 'infix', label: 'Infix' },
  { key: 'stem', label: 'Stem' },
  { key: 'range_index', label: 'Range index' },
];

const chipInputProps = {
  dense: true,
  outlined: true,
  multiple: true,
  useChips: true,
  useInput: true,
  hideDropdownIcon: true,
  newValueMode: 'add-unique' as const,
  inputDebounce: '0',
};

const availableFlags = computed(() => {
  const type = field.value.type;
  return FLAGS.filter((flag) => {
    switch (flag.key) {
      case 'facet':
        return supportsFacet(field.value);
      case 'sort':
        return supportsSort(type);
      case 'infix':
        return supportsTextOptions(type);
      case 'stem':
        return supportsStem(type);
      case 'range_index':
        return supportsRangeIndex(type);
      default:
        return true;
    }
  });
});

const mode = computed(() => vectorMode(field.value));
const embed = computed(() => field.value.embed);
const hnsw = computed(() => field.value.hnsw_params ?? {});
const isRemoteModel = computed(() => {
  const model = embed.value?.model_config.model_name ?? '';
  return model !== '' && !model.startsWith('ts/');
});

const nestedParentHint = computed(() => {
  const name = field.value.name ?? '';
  const parent = props.siblings.find(
    (f) => f !== field.value && isObjectType(f.type) && name.startsWith(`${f.name}.`),
  );
  return parent ? `Nested sub-field of ${parent.name}` : undefined;
});

const embedSourceOptions = computed(() =>
  props.siblings
    .filter((f) => f !== field.value && f.name && canBeEmbedSource(f.type))
    .map((f) => f.name),
);

const hasAdvancedOptions = computed(
  () =>
    supportsTextOptions(field.value.type) ||
    supportsReference(field.value.type) ||
    field.value.type === 'float[]',
);

const advancedLabel = computed(() => {
  const parts: string[] = [];
  if (supportsTextOptions(field.value.type)) parts.push('Text');
  if (supportsReference(field.value.type)) parts.push('Reference');
  if (field.value.type === 'float[]') parts.push('Vector');
  return `${parts.join(', ')} options`;
});

/** Short description of the non-default advanced options, shown while collapsed. */
const advancedSummary = computed(() => {
  const f = field.value;
  const parts: string[] = [];
  if (f.locale) parts.push(`locale ${f.locale}`);
  if (f.truncate_len && f.truncate_len !== 100) parts.push(`truncate ${f.truncate_len}`);
  if (f.token_separators?.length) parts.push('token separators');
  if (f.symbols_to_index?.length) parts.push('symbols');
  if (f.reference) parts.push(`→ ${f.reference}${f.async_reference ? ' (async)' : ''}`);
  if (mode.value === 'vector') parts.push(`vector ${String(f.num_dim)}d`);
  if (mode.value === 'embed') {
    parts.push(`embedding ${embed.value?.model_config.model_name || '(no model)'}`);
  }
  if (mode.value !== 'array' && f.vec_dist && f.vec_dist !== 'cosine') {
    parts.push(f.vec_dist);
  }
  return parts.join(' · ');
});

const advancedOpen = ref(advancedSummary.value !== '');

const filteredReferenceOptions = ref<string[]>([]);

function filterReferences(value: string, update: (fn: () => void) => void) {
  update(() => {
    const needle = value.toLowerCase();
    filteredReferenceOptions.value = props.referenceOptions.filter((o) =>
      o.toLowerCase().includes(needle),
    );
  });
}

function flagValue(key: FlagKey): boolean {
  const value = field.value[key];
  if (typeof value === 'boolean') return value;
  if (key === 'index' || key === 'store') return true;
  if (key === 'sort') return SORTABLE_BY_DEFAULT_TYPES.includes(field.value.type);
  return false;
}

function setFlag(key: FlagKey, value: boolean) {
  field.value[key] = value;
  if (key === 'stem' && !value) delete field.value.stem_dictionary;
}

function changeType(type: string) {
  field.value.type = type as CollectionFieldSchema['type'];
  applyTypeConstraints(field.value);
}

function setNumber(key: 'truncate_len' | 'num_dim', value: string | number | null) {
  const number = value === '' || value === null ? undefined : Number(value);
  if (number === undefined) delete field.value[key];
  else field.value[key] = number;
}

function setHnsw(key: 'M' | 'ef_construction', value: string | number | null) {
  const params = { ...hnsw.value };
  if (value === '' || value === null) delete params[key];
  else params[key] = Number(value);
  if (Object.keys(params).length) field.value.hnsw_params = params;
  else delete field.value.hnsw_params;
}

function setReference(value: string | null) {
  if (value) {
    field.value.reference = value;
    return;
  }
  delete field.value.reference;
  delete field.value.async_reference;
  delete field.value.cascade_delete;
}
</script>
