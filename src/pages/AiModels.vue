<template>
  <q-page class="ts-page">
    <page-header
      :title="copy.title"
      :description="copy.description"
      :help="kind === 'nl' ? 'nlModels' : 'conversationModels'"
    >
      <q-btn
        unelevated
        no-caps
        color="primary"
        icon="sym_s_add"
        label="New model"
        @click="openEditor()"
      />
    </page-header>

    <q-table
      class="ts-table"
      flat
      bordered
      :rows="rows"
      :columns="columns"
      row-key="id"
      :pagination="{ rowsPerPage: 50 }"
      :hide-pagination="rows.length <= 50"
    >
      <template #body-cell-id="cell">
        <q-td :props="cell"
          ><code>{{ cell.value }}</code></q-td
        >
      </template>
      <template #body-cell-model_name="cell">
        <q-td :props="cell">
          <div class="text-mono">{{ modelOnly(cell.value) }}</div>
          <div class="ts-faint text-caption">{{ providerLabel(cell.value) }}</div>
        </q-td>
      </template>
      <template #body-cell-history_collection="cell">
        <q-td :props="cell">
          <router-link
            v-if="cell.value"
            class="ts-link text-mono"
            :to="`/collection/${cell.value}/search`"
          >
            {{ cell.value }}
          </router-link>
        </q-td>
      </template>
      <template #body-cell-actions="cell">
        <q-td :props="cell">
          <q-btn
            flat
            no-caps
            dense
            size="sm"
            icon="sym_s_play_arrow"
            label="Try"
            class="q-mr-xs"
            :disable="!tryCollection"
            @click="tryModel(cell.row.id)"
          >
            <q-tooltip>{{
              tryCollection ? `Try it on ${tryCollection}` : 'Create a collection first'
            }}</q-tooltip>
          </q-btn>
          <q-btn
            flat
            round
            dense
            size="sm"
            icon="sym_s_edit"
            aria-label="Edit model"
            @click="openEditor(cell.row)"
          >
            <q-tooltip>Edit</q-tooltip>
          </q-btn>
          <q-btn
            flat
            round
            dense
            size="sm"
            icon="sym_s_delete"
            aria-label="Delete model"
            class="ts-danger-hover"
            @click="removeModel(cell.row.id)"
          >
            <q-tooltip>Delete</q-tooltip>
          </q-btn>
        </q-td>
      </template>
      <template #no-data>
        <empty-state :icon="copy.icon" :title="copy.emptyTitle" :body="copy.emptyBody">
          <q-btn unelevated no-caps color="primary" label="New model" @click="openEditor()" />
        </empty-state>
      </template>
    </q-table>

    <side-sheet
      v-model="editor.open"
      :title="editor.existingId ? `Edit ${editor.existingId}` : copy.newTitle"
      :description="copy.sheetDescription"
      persistent
    >
      <q-form id="model-form" class="column q-gutter-md" @submit="save">
        <q-select
          v-model="provider"
          outlined
          emit-value
          map-options
          label="Provider"
          :options="providers.map((p) => ({ label: p.label, value: p.prefix }))"
        >
          <template #append><help-tip topic="ai.provider" /></template>
        </q-select>
        <q-input
          v-model="modelSuffix"
          outlined
          label="Model"
          :prefix="provider"
          :placeholder="providerInfo ? providerInfo.example.slice(provider.length) : ''"
          input-class="text-mono"
        />
        <q-input
          v-if="!editor.existingId"
          v-model="editor.form.id"
          outlined
          label="ID (optional)"
          hint="How searches refer to this model. Leave empty to generate one."
          input-class="text-mono"
        />

        <template v-for="field in providerFields" :key="field.key">
          <q-input
            v-if="field.type === 'secret'"
            v-model="editor.form[field.key] as string"
            outlined
            :type="revealed[field.key] ? 'text' : 'password'"
            :label="field.label + (field.required ? '' : ' (optional)')"
            :placeholder="editor.existingId ? 'Saved. Leave empty to keep it.' : ''"
            :stack-label="!!editor.existingId"
            autocomplete="off"
          >
            <template #append>
              <q-btn
                flat
                round
                dense
                size="sm"
                :icon="revealed[field.key] ? 'sym_s_visibility_off' : 'sym_s_visibility'"
                :aria-label="revealed[field.key] ? 'Hide' : 'Show'"
                @click="revealed[field.key] = !revealed[field.key]"
              />
            </template>
          </q-input>
          <q-select
            v-else-if="field.type === 'list'"
            v-model="editor.form[field.key] as string[]"
            outlined
            multiple
            use-chips
            use-input
            hide-dropdown-icon
            new-value-mode="add-unique"
            :label="field.label + (field.required ? '' : ' (optional)')"
            :hint="field.hint"
          />
          <q-input
            v-else
            v-model="editor.form[field.key] as string"
            outlined
            :type="field.type === 'textarea' ? 'textarea' : 'text'"
            :autogrow="field.type === 'textarea'"
            :inputmode="field.type === 'number' ? 'decimal' : undefined"
            :label="field.label + (field.required ? '' : ' (optional)')"
            :hint="field.hint"
            :placeholder="field.placeholder"
          />
        </template>

        <div class="section-label">Model settings</div>

        <template v-for="field in commonFields" :key="field.key">
          <div v-if="field.key === 'history_collection'">
            <q-select
              v-model="editor.form.history_collection as string"
              outlined
              use-input
              fill-input
              hide-selected
              input-debounce="0"
              new-value-mode="add-unique"
              :label="field.label"
              :hint="field.hint"
              :options="collectionNames"
              input-class="text-mono"
              @input-value="(v: string) => (editor.form.history_collection = v)"
            >
              <template v-if="field.help" #append><help-tip :topic="field.help" /></template>
            </q-select>
            <div v-if="historyStatus" class="history-status row items-start no-wrap q-mt-sm">
              <q-icon
                :name="historyStatus.ok ? 'sym_s_check_circle' : 'sym_s_info'"
                size="18px"
                :class="historyStatus.ok ? 'text-positive' : 'ts-faint'"
              />
              <div class="col">
                {{ historyStatus.message }}
                <q-btn
                  v-if="historyStatus.canCreate"
                  flat
                  dense
                  no-caps
                  color="primary"
                  :label="`Create ${editor.form.history_collection}`"
                  :loading="creatingHistory"
                  @click="createHistoryCollection"
                />
              </div>
            </div>
          </div>
          <q-input
            v-else
            v-model="editor.form[field.key] as string"
            outlined
            :type="field.type === 'textarea' ? 'textarea' : 'text'"
            :autogrow="field.type === 'textarea'"
            :inputmode="field.type === 'number' ? 'decimal' : undefined"
            :label="field.label + (field.required ? '' : ' (optional)')"
            :hint="field.hint"
            :placeholder="field.placeholder"
          >
            <template v-if="field.help" #append><help-tip :topic="field.help" /></template>
          </q-input>
        </template>

        <q-banner v-if="editor.errors.length" rounded class="form-errors" role="alert">
          <template #avatar><q-icon name="sym_s_error" /></template>
          <div v-for="error in editor.errors" :key="error">{{ error }}</div>
        </q-banner>
      </q-form>
      <template #actions>
        <q-btn v-close-popup flat no-caps label="Cancel" />
        <q-btn
          unelevated
          no-caps
          color="primary"
          type="submit"
          form="model-form"
          :loading="editor.saving"
          :label="editor.existingId ? 'Save model' : 'Create model'"
        />
      </template>
    </side-sheet>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import type { QTableProps } from 'quasar';
import { useRouter } from 'vue-router';
import { useNodeStore } from '@/stores/node';
import { useAiModelsStore } from '@/stores/aiModels';
import { useCollectionsStore } from '@/stores/collections';
import {
  COMMON_FIELDS,
  PROVIDERS,
  buildModelPayload,
  historyCollectionSchema,
  historySchemaProblems,
  modelToForm,
  newModelForm,
  providerFor,
  validateModel,
} from '@/shared/aiModels';
import type { ModelForm, ModelKind } from '@/shared/aiModels';
import type { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';
import PageHeader from '@/components/ui/PageHeader.vue';
import HelpTip from '@/components/help/HelpTip.vue';
import SideSheet from '@/components/ui/SideSheet.vue';
import EmptyState from '@/components/ui/EmptyState.vue';

const props = defineProps<{ kind: ModelKind }>();

const $q = useQuasar();
const router = useRouter();
const store = useNodeStore();
const models = useAiModelsStore();
const collectionsStore = useCollectionsStore();

const COPY = {
  nl: {
    title: 'Natural-language search',
    description:
      'Connect an LLM that turns a plain-language query like “urgent jobs due this week” into filters, sorting and keywords. Searches opt in with nl_query and the model ID.',
    icon: 'sym_s_translate',
    emptyTitle: 'Connect a model for natural-language search',
    emptyBody:
      'Typesense sends the model your collection schema and the query, and runs the search it gets back.',
    newTitle: 'New natural-language model',
    sheetDescription:
      'Typesense calls this model for searches that set nl_query=true and nl_model_id.',
  },
  conversation: {
    title: 'Conversation models',
    description:
      'Connect an LLM that answers questions from your search results (retrieval-augmented generation). Conversations are stored in a history collection so follow-up questions have context.',
    icon: 'sym_s_forum',
    emptyTitle: 'Connect a model for conversational search',
    emptyBody:
      'Conversational search needs a collection with an auto-embedding field and a model to write the answers.',
    newTitle: 'New conversation model',
    sheetDescription:
      'Typesense calls this model for multi-searches that set conversation=true and conversation_model_id.',
  },
} as const;

const copy = computed(() => COPY[props.kind]);
const providers = computed(() => PROVIDERS[props.kind]);
const rows = computed(() => models.models(props.kind));
const collectionNames = computed(() => collectionsStore.collections.map((c) => c.name).sort());

const columns = computed<QTableProps['columns']>(() => [
  { label: 'ID', name: 'id', field: 'id', align: 'left', sortable: true },
  { label: 'Model', name: 'model_name', field: 'model_name', align: 'left', sortable: true },
  ...(props.kind === 'conversation'
    ? [
        {
          label: 'History',
          name: 'history_collection',
          field: 'history_collection',
          align: 'left' as const,
        },
      ]
    : []),
  { label: '', name: 'actions', field: 'id', align: 'right' },
]);

const editor = reactive<{
  open: boolean;
  existingId: string;
  form: ModelForm;
  errors: string[];
  saving: boolean;
}>({ open: false, existingId: '', form: {}, errors: [], saving: false });
const revealed = reactive<Record<string, boolean>>({});
const creatingHistory = ref(false);

/** The provider prefix and the rest of the model name are edited separately. */
const provider = ref('openai/');
const modelSuffix = ref('');
watch([provider, modelSuffix], () => {
  editor.form.model_name = provider.value + modelSuffix.value.trim();
});

const providerInfo = computed(() => providerFor(props.kind, provider.value));
const providerFields = computed(() => providerInfo.value?.fields ?? []);
const commonFields = computed(() => COMMON_FIELDS[props.kind]);

const historyStatus = computed(() => {
  const name = historyName();
  if (props.kind !== 'conversation' || !name) return null;
  const collection = collectionsStore.collections.find((c) => c.name === name);
  if (!collection) {
    return {
      ok: false,
      canCreate: true,
      message: 'This collection does not exist yet. Typesense needs it before saving the model.',
    };
  }
  const problems = historySchemaProblems(collection);
  return problems.length
    ? {
        ok: false,
        canCreate: false,
        message: `This collection can't store conversations: ${problems.join('; ')}.`,
      }
    : { ok: true, canCreate: false, message: 'Ready to store conversations.' };
});

function historyName(): string {
  const value = editor.form.history_collection;
  return typeof value === 'string' ? value.trim() : '';
}

function modelOnly(modelName: string) {
  const info = providerFor(props.kind, modelName);
  return info ? modelName.slice(info.prefix.length) : modelName;
}

function providerLabel(modelName: string) {
  return providerFor(props.kind, modelName)?.label ?? 'Unknown provider';
}

function openEditor(model?: Record<string, unknown>) {
  editor.existingId = model ? String(model.id) : '';
  editor.form = model ? modelToForm(model) : newModelForm(props.kind);
  if (!model && props.kind === 'conversation') {
    // The name the Typesense docs use.
    editor.form.history_collection = 'conversation_store';
  }
  const info = providerFor(props.kind, editor.form.model_name) ?? providers.value[0]!;
  provider.value = info.prefix;
  modelSuffix.value = String(editor.form.model_name ?? '').slice(info.prefix.length);
  editor.errors = [];
  editor.open = true;
}

async function createHistoryCollection() {
  const name = historyName();
  creatingHistory.value = true;
  await collectionsStore.createCollectionQuietly(
    historyCollectionSchema(name) as CollectionCreateSchema,
  );
  creatingHistory.value = false;
}

async function save() {
  const isNew = !editor.existingId;
  editor.errors = validateModel(props.kind, editor.form, isNew);
  if (editor.errors.length) return;
  editor.saving = true;
  const error = await models.save(
    props.kind,
    buildModelPayload(props.kind, editor.form, isNew),
    editor.existingId || undefined,
  );
  editor.saving = false;
  if (error) {
    editor.errors = [error];
    return;
  }
  editor.open = false;
  $q.notify({
    type: 'positive',
    position: 'top',
    timeout: 1500,
    message: isNew ? 'Model created' : 'Model saved',
  });
}

function removeModel(id: string) {
  $q.dialog({
    title: `Delete ${id}?`,
    message:
      props.kind === 'nl'
        ? 'Searches that use this model ID will fail until they use another model.'
        : 'Conversational searches that use this model ID will fail. Stored conversations stay in the history collection.',
    cancel: { flat: true, noCaps: true, label: 'Cancel' },
    ok: { unelevated: true, noCaps: true, color: 'negative', label: 'Delete model' },
  }).onOk(() => void models.remove(props.kind, id));
}

/** A collection to try the model on: the open one, else the first that fits. */
const tryCollection = computed(() => {
  const collections = collectionsStore.collections;
  const current = collectionsStore.currentCollection?.name;
  const fits = (c: (typeof collections)[number]) =>
    props.kind === 'nl' || c.fields?.some((f) => !!f.embed);
  if (current && collections.some((c) => c.name === current && fits(c))) return current;
  const history = new Set(models.conversationModels.map((m) => m.history_collection));
  return (
    collections
      .filter((c) => fits(c) && !history.has(c.name))
      .sort((a, b) => (b.num_documents ?? 0) - (a.num_documents ?? 0))[0]?.name ?? ''
  );
});

function tryModel(id: string) {
  void router.push({
    path: `/collection/${tryCollection.value}/search`,
    query: { mode: 'ask', [props.kind === 'nl' ? 'nlModel' : 'chatModel']: id },
  });
}

onMounted(() => {
  void models.load(props.kind).catch((error: Error) => store.setError(error.message));
});
watch(
  () => props.kind,
  (kind) => void models.load(kind).catch((error: Error) => store.setError(error.message)),
);
</script>

<style scoped lang="scss">
.section-label {
  margin-top: 24px;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ts-ink-3);
}

.history-status {
  gap: 8px;
  font-size: 0.85rem;
  color: var(--ts-ink-2);
}

.form-errors {
  background: var(--ts-danger-soft);
  color: var(--ts-ink);
  .q-icon {
    color: var(--q-negative);
  }
}
</style>
