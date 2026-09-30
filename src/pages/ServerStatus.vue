<template>
  <q-page padding>
    <div class="row">
      <div class="col col-12 col-md-8">
        <q-card flat bordered class="q-mb-md">
          <q-card-section>
            <div class="text-h5">System</div>
            <div class="text-subtitle1 q-pt-md">CPU</div>
            <q-linear-progress
              v-if="hasCpuOverall"
              size="25px"
              :value="cpuOverallRatio"
              color="accent"
            >
              <div class="absolute-full flex flex-center">
                <q-badge color="white" text-color="accent" :label="`${cpuOverallPercent}%`" />
              </div>
            </q-linear-progress>

            <div class="row q-mt-sm">
              <div
                v-for="cpu in sortedCPU"
                :key="cpu.node"
                class="col-6 col-sm-4 col-md-3 col-lg-2 q-mb-md flex flex-center"
              >
                <div class="column items-center">
                  <span class="text-overline">CPU {{ cpu.node }}</span>
                  <q-circular-progress
                    show-value
                    :value="cpu.value"
                    size="50px"
                    color="accent"
                    track-color="grey-3"
                  />
                </div>
              </div>
            </div>
            <div class="text-subtitle1 q-pt-md">Memory</div>
            <q-linear-progress
              v-if="hasSystemMemory"
              size="25px"
              :value="systemMemoryRatio"
              color="accent"
            >
              <div class="absolute-full flex flex-center">
                <q-badge
                  color="white"
                  text-color="accent"
                  :label="prettyBytes(systemMemoryUsedBytes!)"
                />
              </div>
              <div class="absolute-full flex justify-end">
                <q-badge
                  color="white"
                  text-color="accent"
                  :label="prettyBytes(systemMemoryTotalBytes!)"
                />
              </div>
            </q-linear-progress>

            <div class="text-subtitle1 q-pt-md">Disk</div>

            <q-linear-progress
              v-if="hasSystemDisk"
              size="25px"
              :value="systemDiskRatio"
              color="accent"
            >
              <div class="absolute-full flex flex-center">
                <q-badge
                  color="white"
                  text-color="accent"
                  :label="prettyBytes(systemDiskUsedBytes!)"
                />
              </div>
              <div class="absolute-full flex justify-end">
                <q-badge
                  color="white"
                  text-color="accent"
                  :label="prettyBytes(systemDiskTotalBytes!)"
                />
              </div>
            </q-linear-progress>
            <div class="text-subtitle1 q-pt-md">System Network</div>
            <div>
              Received:
              {{ systemNetworkReceivedLabel }}
              Sent:
              {{ systemNetworkSentLabel }}
            </div>
          </q-card-section>
        </q-card>
        <q-card flat bordered class="q-mb-md">
          <q-item clickable to="/settings">
            <q-item-section avatar><q-icon name="sym_s_settings" /></q-item-section>
            <q-item-section>
              <q-item-label>Settings and operations</q-item-label>
              <q-item-label caption>
                Runtime settings, cache, compaction, snapshots and startup configuration (CORS)
              </q-item-label>
            </q-item-section>
            <q-item-section side><q-icon name="sym_s_chevron_right" /></q-item-section>
          </q-item>
        </q-card>
      </div>
      <q-card flat bordered class="col-12 col-md-3 offset-md-1 q-mb-md">
        <q-card-section>
          <div class="text-h5">Typesense</div>

          <div class="text-subtitle1 q-pt-md">
            Node
            <health-tag :health="store.data.health"></health-tag>
          </div>

          <div>Protocol: {{ store.loginData?.node.protocol }}</div>
          <div>Host: {{ store.loginData?.node.host }}</div>
          <div>Port: {{ store.loginData?.node.port }}</div>
          <div>Connection Timeout: {{ connectionTimeoutDisplay }}</div>
          <div v-if="store.data.debug.version">Version: {{ store.data.debug.version }}</div>
          <div v-if="Object.hasOwnProperty.call(store.data.debug, 'state')">
            Role:
            {{ store.data.debug.state === 1 ? 'Leader' : 'Follower' }}
          </div>

          <template v-if="store.currentClusterTag">
            <div class="text-subtitle1 q-pt-md">Cluster: {{ store.currentClusterTag }}</div>
            <q-list dense separator class="q-mt-xs">
              <q-item
                v-for="(member, idx) in store.clusterMembersForCurrent"
                :key="idx"
                clickable
                :disable="store.isCurrent(member)"
                @click="connectTo(member)"
              >
                <q-item-section>
                  {{ member.node.protocol }}://{{ member.node.host }}:{{ member.node.port }}
                </q-item-section>
                <q-item-section side>
                  <q-chip
                    v-if="store.isCurrent(member)"
                    color="positive"
                    text-color="white"
                    dense
                    size="sm"
                  >
                    Current
                  </q-chip>
                  <q-btn v-else flat dense size="sm" label="Connect" />
                </q-item-section>
              </q-item>
            </q-list>
          </template>

          <div class="text-subtitle1 q-pt-md">Memory</div>
          <div
            v-for="metric in Object.keys(store.data.metrics).filter((m) => m.includes('typesense'))"
            :key="metric"
          >
            {{ metric.split('_')[2] }} :
            {{
              metric.includes('bytes')
                ? prettyBytes(parseInt(store.data.metrics[metric], 10))
                : store.data.metrics[metric]
            }}
          </div>
          <div class="text-subtitle1 q-pt-md">Stats</div>
          <div v-if="!store.data.features.stats">Stats are not enabled on this node.</div>
          <div v-for="(content, label) in store.data.stats" :key="label">
            <div v-if="isObject(content)">
              {{ label }}
              <div v-for="(value, entry) in content" :key="entry">{{ entry }} : {{ value }}</div>
            </div>
          </div>
        </q-card-section>
      </q-card>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { useNodeStore } from '@/stores/node';
import type { NodeLoginDataInterface } from '@/stores/node';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import prettyBytes from 'pretty-bytes';
import HealthTag from '@/components/HealthTag.vue';

const store = useNodeStore();

const refreshInterval = ref<number | undefined>(undefined);
function isObject(obj: unknown) {
  return typeof obj === 'object';
}

onMounted(() => {
  refreshInterval.value = window.setInterval(() => {
    store.refreshServerStatus();
  }, 2000);
});

onBeforeUnmount(() => {
  window.clearInterval(refreshInterval.value);
});

const sortedCPU = computed(() => {
  return Object.entries(store.data.metrics)
    .filter(([key]) => /^system_cpu\d+_active_percentage$/.test(key))
    .map(([key, value]) => {
      let node = 0;
      const keyData = key.split('_');
      if (keyData.length > 1 && keyData[1]) {
        node = parseInt(keyData[1].replace('cpu', '')) || 0;
      }
      return {
        node,
        value: parseFloat(value as string),
      };
    })
    .filter((cpu) => Number.isFinite(cpu.value))
    .sort((a, b) => a.node - b.node);
});

const hasCpuOverall = computed(() =>
  Object.prototype.hasOwnProperty.call(store.data.metrics, 'system_cpu_active_percentage'),
);

const cpuOverallRatio = computed(() => {
  const metrics = store.data.metrics as Record<string, unknown> | undefined;
  const raw = metrics ? metrics['system_cpu_active_percentage'] : undefined;
  const v = typeof raw === 'number' ? raw : typeof raw === 'string' ? parseFloat(raw) : NaN;
  if (!isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v / 100));
});

const cpuOverallPercent = computed(() => Math.round(cpuOverallRatio.value * 100));

function toFiniteNumber(v: unknown): number | null {
  if (typeof v === 'number') {
    return Number.isFinite(v) ? v : null;
  }
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

const systemMemoryUsedBytes = computed(() =>
  toFiniteNumber((store.data.metrics as Record<string, unknown>)?.system_memory_used_bytes),
);

const systemMemoryTotalBytes = computed(() =>
  toFiniteNumber((store.data.metrics as Record<string, unknown>)?.system_memory_total_bytes),
);

const hasSystemMemory = computed(() => {
  const used = systemMemoryUsedBytes.value;
  const total = systemMemoryTotalBytes.value;
  return used !== null && total !== null && total > 0;
});

const systemMemoryRatio = computed(() => {
  if (!hasSystemMemory.value) return 0;
  const ratio = (systemMemoryUsedBytes.value as number) / (systemMemoryTotalBytes.value as number);
  if (!Number.isFinite(ratio)) return 0;
  return Math.max(0, Math.min(1, ratio));
});

const systemDiskUsedBytes = computed(() =>
  toFiniteNumber((store.data.metrics as Record<string, unknown>)?.system_disk_used_bytes),
);

const systemDiskTotalBytes = computed(() =>
  toFiniteNumber((store.data.metrics as Record<string, unknown>)?.system_disk_total_bytes),
);

const hasSystemDisk = computed(() => {
  const used = systemDiskUsedBytes.value;
  const total = systemDiskTotalBytes.value;
  return used !== null && total !== null && total > 0;
});

const systemDiskRatio = computed(() => {
  if (!hasSystemDisk.value) return 0;
  const ratio = (systemDiskUsedBytes.value as number) / (systemDiskTotalBytes.value as number);
  if (!Number.isFinite(ratio)) return 0;
  return Math.max(0, Math.min(1, ratio));
});

const systemNetworkReceivedLabel = computed(() => {
  const v = toFiniteNumber(
    (store.data.metrics as Record<string, unknown>)?.system_network_received_bytes,
  );
  return v === null ? '—' : prettyBytes(v);
});

const systemNetworkSentLabel = computed(() => {
  const v = toFiniteNumber(
    (store.data.metrics as Record<string, unknown>)?.system_network_sent_bytes,
  );
  return v === null ? '—' : prettyBytes(v);
});

const connectionTimeoutDisplay = computed(() => {
  const timeout = store.loginData?.connectionTimeoutSeconds;
  return timeout !== undefined ? `${timeout}s` : 'Default';
});

function connectTo(member: NodeLoginDataInterface) {
  const payload: Parameters<typeof store.login>[0] = {
    apiKey: member.apiKey,
    node: member.node,
    forceHomeRedirect: true,
  };
  if (member.connectionTimeoutSeconds !== undefined) {
    payload.connectionTimeoutSeconds = member.connectionTimeoutSeconds;
  }
  void store.login(payload);
}
</script>
