<template>
  <q-page class="ts-page">
    <div class="doc-grid">
      <section class="ts-sheet editor-card">
        <div class="editor-card__bar row items-center justify-between">
          <div class="row items-center q-gutter-x-xs">
            <q-btn
              flat
              dense
              no-caps
              icon="sym_s_add"
              label="Add example document"
              @click="addTemplate"
            />
            <q-btn
              flat
              dense
              no-caps
              icon="sym_s_upload_file"
              label="Import a file"
              @click="fileInput?.click()"
            />
            <input
              ref="fileInput"
              type="file"
              accept=".jsonl,.json,.ndjson,.txt"
              class="hidden"
              @change="importFile"
            />
          </div>
          <span class="ts-faint text-caption">
            {{ state.documents.length }}
            {{ state.documents.length === 1 ? 'document' : 'documents' }} in the editor
          </span>
        </div>
        <div class="editor">
          <monaco-editor v-model="documentsJson" />
        </div>
        <div v-if="state.jsonError" class="json-error">
          This isn't valid JSON yet: {{ state.jsonError }}
        </div>
      </section>

      <aside class="side">
        <div class="ts-sheet side-card">
          <div class="ts-eyebrow q-mb-sm">When a document's id already exists</div>
          <div class="modes">
            <label
              v-for="mode in MODES"
              :key="mode.value"
              class="mode"
              :class="{ 'is-selected': state.action === mode.value }"
            >
              <input
                v-model="state.action"
                type="radio"
                name="action"
                :value="mode.value"
                class="hidden"
              />
              <span class="mode__label">{{ mode.label }}</span>
              <span class="mode__hint">{{ mode.hint }}</span>
            </label>
          </div>
          <q-btn
            unelevated
            no-caps
            color="primary"
            class="full-width q-mt-md"
            :label="`Import ${state.documents.length} ${state.documents.length === 1 ? 'document' : 'documents'}`"
            :loading="state.importing"
            :disable="!!state.jsonError || !state.documents.length"
            @click="importFromEditor"
          />
          <p class="ts-faint text-caption q-mt-sm q-mb-none">
            Large files go straight to the server with “Import a file” and don't need to fit in the
            editor.
          </p>
        </div>

        <div v-if="state.results" class="ts-sheet side-card">
          <div class="result-summary row items-center no-wrap q-gutter-x-sm">
            <q-icon
              :name="failures.length ? 'sym_s_error' : 'sym_s_check_circle'"
              :color="failures.length ? 'negative' : 'positive'"
              size="22px"
            />
            <div>
              <div class="text-weight-medium">
                {{ successCount.toLocaleString() }} imported<template v-if="failures.length"
                  >, {{ failures.length.toLocaleString() }} failed</template
                >
              </div>
              <div v-if="state.resultSource" class="ts-faint text-caption">
                {{ state.resultSource }}
              </div>
            </div>
          </div>
          <div v-if="failures.length" class="failures">
            <div v-for="failure in failures.slice(0, 50)" :key="failure.line" class="failure">
              <span class="failure__line">Document {{ failure.line }}</span>
              {{ failure.error }}
            </div>
            <div v-if="failures.length > 50" class="ts-faint text-caption q-mt-xs">
              and {{ failures.length - 50 }} more.
            </div>
          </div>
        </div>
      </aside>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useNodeStore } from '@/stores/node';
import MonacoEditor from '@/components/MonacoEditor.vue';
import { buildDocumentTemplate } from '@/shared/documentTemplate';

type DocumentAction = 'create' | 'upsert' | 'update' | 'emplace';

interface ImportResult {
  line: number;
  success: boolean;
  error?: string;
}

const store = useNodeStore();
const route = useRoute();
const fileInput = ref<HTMLInputElement | null>(null);

const MODES: { value: DocumentAction; label: string; hint: string }[] = [
  {
    value: 'upsert',
    label: 'Replace it',
    hint: 'Creates new documents and replaces existing ones.',
  },
  {
    value: 'emplace',
    label: 'Merge into it',
    hint: 'Creates new documents and updates the given fields of existing ones.',
  },
  {
    value: 'update',
    label: 'Update only',
    hint: "Updates existing documents; fails for ids that don't exist.",
  },
  {
    value: 'create',
    label: 'Skip it',
    hint: 'Only creates new documents; fails for ids that already exist.',
  },
];

const state = reactive<{
  documents: Record<string, unknown>[];
  jsonError: string | null;
  action: DocumentAction;
  importing: boolean;
  results: ImportResult[] | null;
  resultSource: string;
}>({
  documents: [],
  jsonError: null,
  action: 'upsert',
  importing: false,
  results: null,
  resultSource: '',
});

const collectionName = computed(() => String(route.params.name ?? ''));
const failures = computed(() => (state.results ?? []).filter((r) => !r.success));
const successCount = computed(() => (state.results ?? []).filter((r) => r.success).length);

const documentsJson = computed({
  get: () => JSON.stringify(state.documents, null, 2),
  set: (json: string) => {
    try {
      const parsed: unknown = JSON.parse(json);
      state.documents = (Array.isArray(parsed) ? parsed : [parsed]) as Record<string, unknown>[];
      state.jsonError = null;
    } catch (e) {
      state.jsonError = (e as Error).message;
    }
  },
});

function template() {
  return buildDocumentTemplate(store.currentCollection?.fields ?? []);
}

function addTemplate() {
  state.documents = [...state.documents, template()];
}

watch(
  () => store.currentCollection?.name,
  () => {
    state.documents = [template()];
    state.results = null;
  },
  { immediate: true },
);

watch(
  () => store.documentsToEdit,
  (docs) => {
    if (docs && docs.length > 0) {
      state.documents = docs;
      state.action = 'upsert';
      store.setDocumentsToEdit([]);
    }
  },
  { immediate: true },
);

function toResults(raw: unknown): ImportResult[] {
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw
          .split('\n')
          .filter((l) => l.trim())
          .map((l) => JSON.parse(l) as unknown)
      : [];
  return list.map((r, index) => {
    const result = (r ?? {}) as { success?: boolean; error?: string };
    return {
      line: index + 1,
      success: result.success === true,
      error: result.error ?? 'Unknown error',
    };
  });
}

async function importFromEditor() {
  state.importing = true;
  try {
    const raw = await store.importDocuments({
      action: state.action,
      documents: JSON.parse(JSON.stringify(state.documents)),
    });
    state.results = toResults(raw);
    state.resultSource = 'From the editor';
    void store.refreshCollection(collectionName.value);
  } catch (error) {
    state.results = [{ line: 1, success: false, error: (error as Error).message }];
  } finally {
    state.importing = false;
  }
}

/** Sends JSONL (or a JSON array, converted) straight to the server without loading it into the editor. */
async function importFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  state.importing = true;
  try {
    let text = (await file.text()).trim();
    if (text.startsWith('[')) {
      text = (JSON.parse(text) as unknown[]).map((d) => JSON.stringify(d)).join('\n');
    }
    const raw = await store.api?.importDocumentsJsonl(collectionName.value, text, state.action);
    state.results = toResults(raw);
    state.resultSource = file.name;
    void store.refreshCollection(collectionName.value);
  } catch (error) {
    state.results = [
      { line: 1, success: false, error: `${file.name}: ${(error as Error).message}` },
    ];
  } finally {
    state.importing = false;
  }
}
</script>

<style scoped lang="scss">
.doc-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 16px;
  align-items: start;
  @media (max-width: 1023px) {
    grid-template-columns: 1fr;
  }
}

.editor-card {
  overflow: hidden;
}

.editor-card__bar {
  padding: 8px 12px;
  border-bottom: 1px solid var(--ts-rule);
}

.editor {
  height: calc(100vh - 330px);
  min-height: 360px;
  display: flex;
}

.json-error {
  padding: 8px 14px;
  font-size: 0.85rem;
  color: var(--q-negative);
  background: var(--ts-danger-soft);
}

.side {
  display: grid;
  gap: 16px;
  position: sticky;
  top: 72px;
}

.side-card {
  padding: 16px;
}

.modes {
  display: grid;
  gap: 6px;
}

.mode {
  display: grid;
  gap: 2px;
  padding: 10px 12px;
  border: 1px solid var(--ts-rule);
  border-radius: 10px;
  cursor: pointer;
  &:hover {
    border-color: var(--ts-rule-strong);
  }
  &.is-selected {
    border-color: var(--ts-primary);
    box-shadow: 0 0 0 1px var(--ts-primary);
  }
}

.mode__label {
  font-weight: 500;
  font-size: 0.875rem;
}

.mode__hint {
  font-size: 0.78rem;
  color: var(--ts-ink-3);
}

.failures {
  margin-top: 12px;
  max-height: 280px;
  overflow-y: auto;
  border-top: 1px solid var(--ts-rule);
  padding-top: 8px;
}

.failure {
  font-size: 0.8rem;
  padding: 4px 0;
  color: var(--ts-ink-2);
}

.failure__line {
  font-family: var(--ts-font-mono);
  color: var(--ts-ink);
  margin-right: 6px;
}
</style>
