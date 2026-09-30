<template>
  <div class="ask">
    <div class="ask__controls ts-sheet">
      <q-btn-toggle
        v-model="mode"
        no-caps
        unelevated
        dense
        toggle-color="primary"
        class="mode-toggle"
        :options="[
          { label: 'Find with filters', value: 'nl', icon: 'sym_s_translate' },
          { label: 'Get an answer', value: 'chat', icon: 'sym_s_forum' },
        ]"
      />
      <p class="ask__explainer">
        <template v-if="mode === 'nl'">
          A natural-language model turns your question into a search: keywords, filters and sorting.
          You see exactly what it chose.
        </template>
        <template v-else>
          A conversation model answers from the best-matching documents. Follow-up questions keep
          the context until you start a new conversation.
        </template>
      </p>

      <empty-state
        v-if="!modelOptions.length"
        :icon="mode === 'nl' ? 'sym_s_translate' : 'sym_s_forum'"
        :title="mode === 'nl' ? 'No natural-language model yet' : 'No conversation model yet'"
        :body="
          mode === 'nl'
            ? 'Connect an LLM such as OpenAI, Gemini or a self-hosted vLLM server first.'
            : 'Connect an LLM and choose a history collection for conversations first.'
        "
      >
        <q-btn
          unelevated
          no-caps
          color="primary"
          label="Connect a model"
          :to="mode === 'nl' ? '/nl-models' : '/conversation-models'"
        />
      </empty-state>

      <empty-state
        v-else-if="mode === 'chat' && !embeddingFields.length"
        icon="sym_s_hub"
        title="This collection has no auto-embedding field"
        body="Conversational search finds documents by meaning, so it needs a float[] field with embed.from set. Add one on the Schema tab."
      >
        <q-btn
          unelevated
          no-caps
          color="primary"
          label="Open schema"
          :to="`/collection/${collectionName}/schema`"
        />
      </empty-state>

      <template v-else>
        <div class="ask__settings">
          <q-select
            v-model="modelId"
            outlined
            dense
            emit-value
            map-options
            label="Model"
            :options="modelOptions"
            options-dense
          />
          <q-select
            v-model="queryBy"
            outlined
            dense
            multiple
            use-chips
            :label="mode === 'nl' ? 'Search in fields' : 'Embedding field'"
            :options="mode === 'nl' ? textFields : embeddingFields"
            options-dense
          />
        </div>
        <q-form class="ask__form row no-wrap items-start" @submit="ask">
          <q-input
            v-model="question"
            class="col"
            outlined
            autofocus
            :placeholder="
              mode === 'nl' ? 'e.g. urgent open milestones due soonest' : 'Ask a question'
            "
            :aria-label="mode === 'nl' ? 'Search in plain language' : 'Question'"
          />
          <q-btn
            unelevated
            no-caps
            color="primary"
            type="submit"
            icon="sym_s_arrow_upward"
            :label="mode === 'nl' ? 'Search' : 'Ask'"
            :loading="loading"
            :disable="!question.trim() || !modelId || !queryBy.length"
            class="ask__submit"
          />
        </q-form>
      </template>
    </div>

    <q-banner v-if="error" rounded class="ask__error q-mt-md" role="alert">
      <template #avatar><q-icon name="sym_s_error" /></template>
      {{ error }}
    </q-banner>

    <!-- Natural-language search result -->
    <section v-if="mode === 'nl' && nlResult" class="q-mt-lg">
      <div class="ts-sheet understood">
        <div class="understood__head row items-baseline">
          <h3 class="ts-section-title">Understood as</h3>
          <q-space />
          <span class="ts-faint text-caption"
            >Model took {{ nlResult.parseTimeMs }} ms · {{ nlResult.found }} matches</span
          >
        </div>
        <dl class="understood__params">
          <template v-for="(value, key) in nlResult.params" :key="key">
            <dt>{{ key }}</dt>
            <dd>
              <code>{{ value === '' ? '(none)' : value }}</code>
            </dd>
          </template>
        </dl>
        <p v-if="!Object.keys(nlResult.params).length" class="ts-faint q-mb-none">
          The model didn't add any parameters, so this ran as a plain keyword search.
        </p>
      </div>
      <div class="hits q-mt-md">
        <article v-for="(doc, i) in nlResult.hits" :key="String(doc.id ?? i)" class="hit ts-sheet">
          <div class="hit__title">{{ titleOf(doc) }}</div>
          <dl class="hit__fields">
            <template v-for="[key, value] in previewFields(doc)" :key="key">
              <dt>{{ key }}</dt>
              <dd>{{ value }}</dd>
            </template>
          </dl>
        </article>
      </div>
      <p v-if="!nlResult.hits.length" class="ts-faint q-mt-md">
        No documents match. Check the filters above; the model may have picked a value that doesn't
        exist in your data.
      </p>
    </section>

    <!-- Conversation -->
    <section v-if="mode === 'chat' && turns.length" class="q-mt-lg">
      <div class="row items-center q-mb-sm">
        <span class="ts-faint text-caption">
          Conversation <code>{{ conversationId }}</code>
        </span>
        <q-space />
        <q-btn
          flat
          dense
          no-caps
          size="sm"
          icon="sym_s_add_comment"
          label="New conversation"
          @click="resetConversation"
        />
      </div>
      <div class="thread">
        <template v-for="(turn, i) in turns" :key="i">
          <div class="bubble bubble--user">{{ turn.question }}</div>
          <div class="bubble bubble--answer ts-sheet">
            <div class="bubble__answer">{{ turn.answer || 'The model returned no answer.' }}</div>
            <details v-if="turn.sources.length" class="bubble__sources">
              <summary>Based on {{ turn.sources.length }} of {{ turn.found }} matches</summary>
              <ul>
                <li v-for="(doc, j) in turn.sources" :key="j">
                  <code>{{ doc.id }}</code> {{ titleOf(doc) }}
                </li>
              </ul>
            </details>
          </div>
        </template>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useCollectionsStore } from '@/stores/collections';
import { useDocumentsStore } from '@/stores/documents';
import { useAiModelsStore } from '@/stores/aiModels';
import EmptyState from '@/components/ui/EmptyState.vue';
import { serverMessage } from '@/shared/errors';

interface Turn {
  question: string;
  answer: string;
  found: number;
  sources: Record<string, unknown>[];
}

const route = useRoute();
const collectionsStore = useCollectionsStore();
const documentsStore = useDocumentsStore();
const aiModels = useAiModelsStore();

const mode = ref<'nl' | 'chat'>(route.query.chatModel ? 'chat' : 'nl');
const modelId = ref('');
const queryBy = ref<string[]>([]);
const question = ref('');
const loading = ref(false);
const error = ref('');

const nlResult = ref<{
  params: Record<string, string>;
  parseTimeMs: number;
  found: number;
  hits: Record<string, unknown>[];
} | null>(null);
const turns = ref<Turn[]>([]);
const conversationId = ref('');

const collection = computed(() => collectionsStore.currentCollection);
const collectionName = computed(() => collection.value?.name ?? '');
const fields = computed(() => collection.value?.fields ?? []);

const textFields = computed(() =>
  fields.value
    .filter(
      (f) => ['string', 'string[]'].includes(f.type) && f.index !== false && !f.name.includes('*'),
    )
    .map((f) => f.name),
);
const embeddingFields = computed(() => fields.value.filter((f) => !!f.embed).map((f) => f.name));

const modelOptions = computed(() =>
  (mode.value === 'nl' ? aiModels.nlModels : aiModels.conversationModels).map((m) => ({
    label: `${m.id} · ${m.model_name}`,
    value: m.id,
  })),
);

function pickDefaults() {
  const requested = String(route.query[mode.value === 'nl' ? 'nlModel' : 'chatModel'] ?? '');
  const ids = modelOptions.value.map((o) => o.value);
  if (!ids.includes(modelId.value)) {
    modelId.value = ids.includes(requested) ? requested : (ids[0] ?? '');
  }
  queryBy.value =
    mode.value === 'nl' ? textFields.value.slice(0, 3) : embeddingFields.value.slice(0, 1);
  error.value = '';
}

/** Embeddings are long and not meaningful to read, so they are left out of results. */
const excludeFields = computed(() => embeddingFields.value.join(','));

async function ask() {
  const q = question.value.trim();
  if (!q) return;
  loading.value = true;
  error.value = '';
  try {
    if (mode.value === 'nl') {
      const response = (await documentsStore.search({
        q,
        query_by: queryBy.value.join(','),
        nl_query: true,
        nl_model_id: modelId.value,
        per_page: 12,
        ...(excludeFields.value ? { exclude_fields: excludeFields.value } : {}),
      } as never)) as unknown as {
        found: number;
        hits?: { document: Record<string, unknown> }[];
        parsed_nl_query?: { parse_time_ms?: number; generated_params?: Record<string, unknown> };
      };
      const generated = response.parsed_nl_query?.generated_params ?? {};
      nlResult.value = {
        params: Object.fromEntries(
          Object.entries(generated).map(([k, v]) => [
            k,
            typeof v === 'string' ? v : JSON.stringify(v),
          ]),
        ),
        parseTimeMs: response.parsed_nl_query?.parse_time_ms ?? 0,
        found: response.found,
        hits: (response.hits ?? []).map((h) => h.document),
      };
    } else {
      const result = await documentsStore.converse({
        collectionName: collectionName.value,
        question: q,
        modelId: modelId.value,
        queryBy: queryBy.value.join(','),
        excludeFields: excludeFields.value,
        ...(conversationId.value ? { conversationId: conversationId.value } : {}),
      });
      conversationId.value = result.conversationId;
      turns.value.push({
        question: q,
        answer: result.answer,
        found: result.found,
        sources: result.sources,
      });
      question.value = '';
    }
  } catch (e) {
    error.value = serverMessage(e);
  } finally {
    loading.value = false;
  }
}

function resetConversation() {
  turns.value = [];
  conversationId.value = '';
}

/** The first text value in schema order makes a readable title for a result. */
function titleOf(doc: Record<string, unknown>): string {
  for (const f of fields.value) {
    const value = doc[f.name];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return typeof doc.id === 'string' ? doc.id : '';
}

function previewFields(doc: Record<string, unknown>): [string, string][] {
  return Object.entries(doc)
    .filter(([key]) => key !== 'id')
    .slice(0, 5)
    .map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)]);
}

onMounted(() => {
  void Promise.allSettled([aiModels.loadNl(), aiModels.loadConversation()]).then(pickDefaults);
});
watch([mode, collectionName], () => {
  nlResult.value = null;
  resetConversation();
  pickDefaults();
});
watch(modelOptions, pickDefaults);
</script>

<style scoped lang="scss">
.ask__controls {
  padding: 16px;
}

.ask__explainer {
  margin: 10px 0 14px;
  color: var(--ts-ink-2);
  font-size: 0.875rem;
  max-width: 70ch;
}

.ask__settings {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
  gap: 12px;
  margin-bottom: 12px;
  @media (max-width: 599px) {
    grid-template-columns: minmax(0, 1fr);
  }
}

.ask__form {
  gap: 8px;
}

.ask__submit {
  height: 56px;
}

.ask__error {
  background: var(--ts-danger-soft);
  color: var(--ts-ink);
  .q-icon {
    color: var(--q-negative);
  }
}

.understood {
  padding: 16px;
}

.understood__params {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 6px 16px;
  margin: 12px 0 0;
  dt {
    font-family: var(--ts-font-mono);
    font-size: 0.8rem;
    color: var(--ts-ink-3);
  }
  dd {
    margin: 0;
    overflow-wrap: anywhere;
    code {
      background: var(--ts-mark);
      color: #1b1b1b;
      padding: 1px 6px;
      border-radius: 4px;
    }
  }
}

.hits {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}

.hit {
  padding: 14px 16px;
}

.hit__title {
  font-weight: 600;
  margin-bottom: 8px;
  overflow-wrap: anywhere;
}

.hit__fields {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 2px 10px;
  margin: 0;
  font-size: 0.8rem;
  dt {
    font-family: var(--ts-font-mono);
    color: var(--ts-ink-3);
  }
  dd {
    margin: 0;
    color: var(--ts-ink-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.thread {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.bubble {
  max-width: min(720px, 100%);
  padding: 10px 14px;
  border-radius: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
}

.bubble--user {
  align-self: flex-end;
  background: var(--ts-primary);
  color: #fff;
}

.bubble--answer {
  align-self: flex-start;
}

.bubble__sources {
  margin-top: 8px;
  font-size: 0.8rem;
  color: var(--ts-ink-2);
  white-space: normal;
  summary {
    cursor: pointer;
  }
  ul {
    margin: 6px 0 0;
    padding-left: 18px;
  }
}
</style>
