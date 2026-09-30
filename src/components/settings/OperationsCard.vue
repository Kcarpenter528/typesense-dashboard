<template>
  <q-card flat bordered>
    <q-card-section>
      <div class="row items-center q-gutter-sm">
        <q-icon name="sym_s_build" size="sm" />
        <div class="text-h6">Operations</div>
      </div>
    </q-card-section>
    <q-separator />

    <q-card-section class="q-py-sm">
      <div class="row items-center justify-between">
        <div class="text-overline text-grey-7">This node</div>
        <q-btn
          flat
          dense
          round
          size="sm"
          icon="sym_s_refresh"
          aria-label="Refresh"
          :loading="refreshing"
          @click="refresh"
        />
      </div>
      <div class="row q-col-gutter-sm">
        <div class="col-6">
          <div class="text-caption text-grey-7">Version</div>
          <div>{{ store.data.debug?.version ?? 'Unknown' }}</div>
        </div>
        <div class="col-6">
          <div class="text-caption text-grey-7">Role</div>
          <div>{{ role }}</div>
        </div>
        <template v-if="status">
          <div class="col-6">
            <div class="text-caption text-grey-7">Queued writes</div>
            <div>{{ status.queued_writes ?? '—' }}</div>
          </div>
          <div class="col-6">
            <div class="text-caption text-grey-7">Committed index</div>
            <div>{{ status.committed_index ?? '—' }}</div>
          </div>
        </template>
      </div>

      <template v-if="schemaChanges !== null">
        <div class="text-caption text-grey-7 q-mt-md">Schema changes in progress</div>
        <div v-if="!schemaChanges.length">None</div>
        <div v-for="change in schemaChanges" :key="change.collection" class="q-mt-xs">
          <code>{{ change.collection }}</code>
          <span class="text-grey-8">
            · {{ change.validated_docs ?? 0 }} validated, {{ change.altered_docs ?? 0 }} updated
          </span>
        </div>
      </template>
    </q-card-section>

    <q-separator />
    <q-list separator>
      <q-item v-for="op in operations" :key="op.label" class="q-py-md">
        <q-item-section>
          <q-item-label class="text-weight-medium">{{ op.label }}</q-item-label>
          <q-item-label caption>{{ op.description }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-btn
            unelevated
            no-caps
            color="primary"
            :label="op.action"
            :loading="busy === op.label"
            :disable="busy !== null && busy !== op.label"
            @click="op.run"
          />
        </q-item-section>
      </q-item>
    </q-list>
  </q-card>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useQuasar } from 'quasar';
import { useNodeStore } from '@/stores/node';
import type { NodeStatus, SchemaChangeStatus } from '@/stores/node';

const $q = useQuasar();
const store = useNodeStore();

const status = ref<NodeStatus | null>(null);
const schemaChanges = ref<SchemaChangeStatus[] | null>(null);
const refreshing = ref(false);
const busy = ref<string | null>(null);

const role = computed(() => {
  if (status.value?.state)
    return status.value.state.toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
  const state = store.data.debug?.state;
  if (state === 1) return 'Leader';
  if (state === 4) return 'Follower';
  return 'Unknown';
});

async function refresh() {
  refreshing.value = true;
  [status.value, schemaChanges.value] = await Promise.all([
    store.getNodeStatus(),
    store.getSchemaChanges(),
  ]);
  refreshing.value = false;
}

async function run(label: string, task: () => Promise<unknown>) {
  busy.value = label;
  try {
    await task();
  } finally {
    busy.value = null;
  }
}

const operations = [
  {
    label: 'Clear search cache',
    action: 'Clear',
    description: 'Empty the cache used by searches sent with use_cache=true.',
    run: () => run('Clear search cache', () => store.clearCache()),
  },
  {
    label: 'Compact database',
    action: 'Compact',
    description:
      'Reclaim disk space from deleted and updated documents. Best run during off-peak hours.',
    run: () =>
      $q
        .dialog({
          title: 'Compact the database?',
          message: 'Compaction uses extra CPU and disk while it runs. It is best done off-peak.',
          cancel: true,
          ok: { label: 'Compact', unelevated: true },
        })
        .onOk(() => void run('Compact database', () => store.operationCompactDB())),
  },
  {
    label: 'Create snapshot',
    action: 'Snapshot',
    description:
      'Write a point-in-time backup of this node to a directory on the server, e.g. to copy off for backups.',
    run: () =>
      $q
        .dialog({
          title: 'Create snapshot',
          message: 'Directory on the server where the snapshot is written:',
          prompt: {
            model: `/tmp/typesense-snapshot-${new Date().toISOString().slice(0, 16).replace(':', '-')}`,
            type: 'text',
            isValid: (value: string) => value.trim().startsWith('/'),
          },
          cancel: true,
          ok: { label: 'Create', unelevated: true },
        })
        .onOk(
          (path: string) => void run('Create snapshot', () => store.createSnapshot(path.trim())),
        ),
  },
  {
    label: 'Trigger leader election',
    action: 'Elect',
    description:
      'Ask this node to step down so the cluster elects a new leader, e.g. before restarting it. Clusters only.',
    run: () =>
      void run('Trigger leader election', async () => {
        const ok = await store.triggerLeaderElection();
        $q.notify({
          type: ok ? 'positive' : 'info',
          position: 'top',
          message: ok
            ? 'Leader election started'
            : 'No election was started. A single-node server has no other node to take over.',
        });
        await refresh();
      }),
  },
];

onMounted(refresh);
</script>
