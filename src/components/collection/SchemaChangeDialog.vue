<template>
  <q-dialog ref="dialogRef" :persistent="busy" @hide="onDialogHide">
    <q-card class="schema-change-dialog">
      <q-card-section class="row items-center no-wrap q-gutter-sm">
        <q-icon
          :name="plan.requiresRecreate ? 'sym_s_restart_alt' : 'sym_s_difference'"
          size="md"
          :color="plan.requiresRecreate ? 'warning' : 'primary'"
        />
        <div class="text-h6">
          {{ plan.requiresRecreate ? 'Recreate collection' : 'Review schema changes' }}
        </div>
      </q-card-section>

      <q-separator />

      <q-card-section v-if="result" class="scroll body">
        <template v-if="result.ok">
          <q-banner rounded class="bg-positive text-white">
            <template #avatar><q-icon name="sym_s_check_circle" /></template>
            {{ collectionName }} was recreated with {{ result.documentCount }} documents.
            <span v-if="result.backupName">
              A copy of the previous data was kept as <code>{{ result.backupName }}</code
              >.
            </span>
          </q-banner>
        </template>
        <template v-else>
          <q-banner rounded class="bg-negative text-white q-mb-md">
            <template #avatar><q-icon name="sym_s_error" /></template>
            <template v-if="result.backupName">
              {{ result.failures.length }} documents failed to import into the recreated collection.
              All documents are still available in <code>{{ result.backupName }}</code
              >.
            </template>
            <template v-else>
              {{ result.failures.length }} of {{ result.documentCount }} documents do not match the
              new schema. Nothing was changed.
            </template>
          </q-banner>
          <div
            v-for="failure in result.failures.slice(0, 20)"
            :key="failure.line"
            class="failure q-mb-sm"
          >
            <div class="text-weight-medium">Document {{ failure.line }}: {{ failure.error }}</div>
            <code class="ellipsis block text-grey-7">{{ failure.document }}</code>
          </div>
          <div v-if="result.failures.length > 20" class="text-grey-7">
            …and {{ result.failures.length - 20 }} more.
          </div>
        </template>
      </q-card-section>

      <q-card-section v-else class="scroll body">
        <template v-if="plan.requiresRecreate">
          <p>
            The following settings can only be set when a collection is created. To apply them, the
            collection has to be recreated and its documents re-imported.
          </p>
          <q-list bordered separator class="rounded-borders q-mb-md">
            <q-item v-for="change in plan.createOnly" :key="change.key">
              <q-item-section>
                <q-item-label>
                  <code>{{ change.key }}</code>
                </q-item-label>
                <q-item-label caption>
                  <span class="text-strike">{{ formatValue(change.before) }}</span>
                  → <span class="text-weight-medium">{{ formatValue(change.after) }}</span>
                </q-item-label>
                <q-item-label v-if="change.reason" caption>{{ change.reason }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
          <p class="text-grey-8">
            What happens: all {{ documentCount }} documents are exported and first imported into a
            temporary collection to check them against the new schema. If any document fails,
            nothing is changed. Otherwise <code>{{ collectionName }}</code> is dropped, created
            again with the same name and the documents are imported into it. Aliases, API keys and
            linked synonym or curation sets keep working because the name does not change.
          </p>
          <q-banner v-if="documentCount > 100000" rounded class="bg-warning q-mb-md">
            Documents pass through your browser during this process. With
            {{ documentCount }} documents this can take a while and use a lot of memory.
          </q-banner>
          <q-checkbox
            v-model="keepBackup"
            :disable="busy"
            label="Keep the temporary copy as a backup"
          />
          <div class="text-subtitle2 q-mt-md">Other changes included in the new schema</div>
          <div v-if="!hasFieldOrSettingChanges" class="text-grey-7">None</div>
        </template>

        <template v-if="hasFieldOrSettingChanges">
          <div v-if="plan.added.length" class="q-mb-md">
            <div class="text-subtitle2 text-positive">
              <q-icon name="sym_s_add" /> Add {{ plan.added.length }} field(s)
            </div>
            <div v-for="field in plan.added" :key="field.name" class="q-ml-md">
              <code>{{ field.name }}</code> <span class="text-grey-7">{{ field.type }}</span>
            </div>
          </div>
          <div v-if="plan.modified.length" class="q-mb-md">
            <div class="text-subtitle2 text-info">
              <q-icon name="sym_s_edit" /> Modify {{ plan.modified.length }} field(s)
            </div>
            <div v-for="mod in plan.modified" :key="mod.name" class="q-ml-md">
              <code>{{ mod.name }}</code>
              <span v-for="change in mod.changes" :key="change.key" class="text-grey-8">
                · {{ change.key }}: {{ formatValue(change.before) }} →
                {{ formatValue(change.after) }}
              </span>
            </div>
          </div>
          <div v-if="plan.dropped.length" class="q-mb-md">
            <div class="text-subtitle2 text-negative">
              <q-icon name="sym_s_remove" /> Remove {{ plan.dropped.length }} field(s)
            </div>
            <div class="q-ml-md">
              <code v-for="name in plan.dropped" :key="name" class="q-mr-sm">{{ name }}</code>
            </div>
            <div class="q-ml-md text-caption text-grey-7">
              The values stay in the stored documents but are no longer indexed or searchable.
            </div>
          </div>
          <div v-if="plan.settings.length" class="q-mb-md">
            <div class="text-subtitle2"><q-icon name="sym_s_tune" /> Update settings</div>
            <div v-for="change in plan.settings" :key="change.key" class="q-ml-md">
              <code>{{ change.key }}</code
              >: {{ formatValue(change.before) }} →
              {{ formatValue(change.after) }}
            </div>
          </div>
          <template v-if="!plan.requiresRecreate">
            <div class="text-caption text-grey-7 q-mb-sm">
              Typesense applies schema changes synchronously and re-indexes the affected fields,
              which can take a while on large collections.
            </div>
            <q-expansion-item dense label="Request body" icon="sym_s_data_object" class="q-mt-sm">
              <pre class="payload q-pa-sm q-ma-none">{{ payloadJson }}</pre>
            </q-expansion-item>
          </template>
        </template>

        <q-banner v-if="errorMessage" rounded class="bg-negative text-white q-mt-md">
          {{ errorMessage }}
        </q-banner>
      </q-card-section>

      <q-separator />

      <q-card-actions align="right">
        <div v-if="busy" class="q-mr-auto q-ml-sm row items-center q-gutter-sm text-grey-8">
          <q-spinner size="sm" />
          <span>{{ progressMessage }}</span>
        </div>
        <template v-if="result">
          <q-btn
            unelevated
            label="Close"
            color="primary"
            @click="result.ok ? onDialogOK() : onDialogCancel()"
          />
        </template>
        <template v-else>
          <q-btn flat label="Cancel" :disable="busy" @click="onDialogCancel" />
          <q-btn
            unelevated
            :color="plan.requiresRecreate ? 'warning' : 'primary'"
            :label="plan.requiresRecreate ? 'Recreate collection' : 'Apply changes'"
            :loading="busy"
            @click="apply"
          />
        </template>
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useDialogPluginComponent } from 'quasar';
import type { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';
import type { SchemaChangePlan } from '@/shared/schemaDiff';
import { useNodeStore } from '@/stores/node';
import type { RecreateCollectionResult } from '@/stores/node';

const props = defineProps<{
  plan: SchemaChangePlan;
  collectionName: string;
  documentCount: number;
  editedSchema: CollectionCreateSchema;
}>();

defineEmits([...useDialogPluginComponent.emits]);

const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent();
const store = useNodeStore();

const busy = ref(false);
const keepBackup = ref(false);
const progressMessage = ref('');
const errorMessage = ref<string | null>(null);
const result = ref<RecreateCollectionResult | null>(null);

const hasFieldOrSettingChanges = computed(
  () =>
    props.plan.added.length +
      props.plan.modified.length +
      props.plan.dropped.length +
      props.plan.settings.length >
    0,
);

const payloadJson = computed(() => JSON.stringify(props.plan.payload, null, 2));

function formatValue(value: unknown): string {
  if (value === '' || value === undefined || value === null) return '(none)';
  return typeof value === 'string' ? value : JSON.stringify(value);
}

async function apply() {
  busy.value = true;
  errorMessage.value = null;
  try {
    if (props.plan.requiresRecreate) {
      result.value = await store.recreateCollection({
        collectionName: props.collectionName,
        schema: props.editedSchema,
        keepBackup: keepBackup.value,
        onProgress: (message) => (progressMessage.value = message),
      });
    } else if (props.plan.payload) {
      progressMessage.value = 'Updating schema';
      const ok = await store.updateCollection({
        collectionName: props.collectionName,
        schema: props.plan.payload,
      });
      if (ok) {
        onDialogOK();
      } else {
        errorMessage.value = store.error;
        store.setError(null);
      }
    }
  } catch (error) {
    errorMessage.value = (error as Error).message;
  } finally {
    busy.value = false;
  }
}
</script>

<style scoped>
.schema-change-dialog {
  width: 640px;
  max-width: 95vw;
}
.body {
  max-height: 65vh;
}
.payload {
  background: rgba(127, 127, 127, 0.1);
  border-radius: 4px;
  font-size: 12px;
  overflow: auto;
  max-height: 240px;
}
.failure code {
  font-size: 12px;
}
</style>
