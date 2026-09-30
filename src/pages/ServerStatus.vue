<template>
  <q-page class="ts-page">
    <page-header help="status" title="Server status">
      <template #description>
        <span class="health" :class="healthClass">
          <span class="health__dot" aria-hidden="true" />
          {{ healthLabel }}
        </span>
        <span v-if="store.data.health?.resource_error" class="q-ml-sm text-negative">
          {{ store.data.health.resource_error }}
        </span>
        <span class="ts-faint q-ml-sm">· Updates every 2 seconds</span>
      </template>
    </page-header>

    <div class="kpis">
      <stat-tile label="Collections" :value="compact(collectionsStore.collections.length)" />
      <stat-tile
        label="Documents"
        :value="compact(totalDocuments)"
        :detail="`across ${collectionsStore.collections.length} collections`"
      />
      <stat-tile
        label="Requests per second"
        :value="stats ? compact(stats.total_requests_per_second ?? 0, 1) : '—'"
        :detail="
          stats
            ? `${compact(stats.search_requests_per_second ?? 0, 1)} searches`
            : 'Stats unavailable'
        "
      />
      <stat-tile
        label="Search latency"
        :value="stats ? `${compact(stats.search_latency_ms ?? 0, 1)} ms` : '—'"
        :detail="stats ? `Cache hit ratio ${Math.round((stats.cache_hit_ratio ?? 0) * 100)}%` : ''"
      />
    </div>

    <div class="grid">
      <section class="ts-sheet card">
        <h2 class="ts-section-title q-mb-md">Machine</h2>
        <div class="meters">
          <meter-bar
            v-if="cpu !== null"
            label="CPU"
            :ratio="cpu / 100"
            :value-label="`${Math.round(cpu)}%`"
          />
          <meter-bar
            v-if="memory"
            label="Memory"
            :ratio="memory.used / memory.total"
            :value-label="`${prettyBytes(memory.used)} of ${prettyBytes(memory.total)}`"
          />
          <meter-bar
            v-if="disk"
            label="Disk"
            :ratio="disk.used / disk.total"
            :value-label="`${prettyBytes(disk.used)} of ${prettyBytes(disk.total)}`"
            detail="Writes are rejected above the server's disk limit."
          />
          <div v-if="!hasMetrics" class="ts-faint">This API key can't read machine metrics.</div>
        </div>

        <template v-if="cores.length">
          <div class="ts-eyebrow q-mt-lg q-mb-sm">{{ cores.length }} CPU cores</div>
          <div class="cores">
            <div v-for="core in cores" :key="core.node" class="core">
              <div class="core__track">
                <div class="core__fill" :style="{ height: `${Math.min(100, core.value)}%` }" />
              </div>
              <span class="core__label">{{ core.node }}</span>
              <q-tooltip>Core {{ core.node }}: {{ Math.round(core.value) }}%</q-tooltip>
            </div>
          </div>
        </template>

        <div v-if="network" class="network">
          <span><q-icon name="sym_s_south" size="16px" /> {{ network.received }} received</span>
          <span><q-icon name="sym_s_north" size="16px" /> {{ network.sent }} sent</span>
        </div>
      </section>

      <section class="ts-sheet card">
        <h2 class="ts-section-title q-mb-md">This node</h2>
        <dl class="facts">
          <dt>Address</dt>
          <dd class="text-mono">{{ address }}</dd>
          <dt>Version</dt>
          <dd>{{ store.data.debug?.version ?? '—' }}</dd>
          <dt>Role</dt>
          <dd>{{ role }}</dd>
          <dt>Timeout</dt>
          <dd>{{ connectionTimeoutDisplay }}</dd>
        </dl>

        <template v-if="store.currentClusterTag">
          <div class="ts-eyebrow q-mt-lg q-mb-xs">Cluster {{ store.currentClusterTag }}</div>
          <q-list dense separator class="cluster">
            <q-item
              v-for="(member, idx) in store.clusterMembersForCurrent"
              :key="idx"
              :clickable="!store.isCurrent(member)"
              @click="!store.isCurrent(member) && connectTo(member)"
            >
              <q-item-section class="text-mono">
                {{ member.node.host }}:{{ member.node.port }}
              </q-item-section>
              <q-item-section side>
                <span v-if="store.isCurrent(member)" class="ts-faint text-caption">Connected</span>
                <span v-else class="text-primary text-caption">Switch</span>
              </q-item-section>
            </q-item>
          </q-list>
        </template>

        <q-btn
          flat
          no-caps
          color="primary"
          icon="sym_s_tune"
          label="Settings and operations"
          class="q-mt-lg"
          to="/settings"
        />
      </section>
    </div>

    <div class="grid q-mt-md">
      <section class="ts-sheet card">
        <h2 class="ts-section-title q-mb-sm">Traffic by endpoint</h2>
        <table v-if="endpoints.length" class="data-table">
          <thead>
            <tr>
              <th>Endpoint</th>
              <th class="num">Requests/s</th>
              <th class="num">Latency</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="e in endpoints" :key="e.name">
              <td class="text-mono">{{ e.name }}</td>
              <td class="num">{{ e.rps.toFixed(1) }}</td>
              <td class="num">{{ e.latency.toFixed(1) }} ms</td>
            </tr>
          </tbody>
        </table>
        <div v-else class="ts-faint q-py-md">
          {{
            store.data.features.stats
              ? 'No requests in the last few seconds.'
              : "This API key can't read request stats."
          }}
        </div>
      </section>

      <section class="ts-sheet card">
        <h2 class="ts-section-title q-mb-sm">Typesense memory</h2>
        <table v-if="typesenseMemory.length" class="data-table">
          <tbody>
            <tr v-for="m in typesenseMemory" :key="m.name">
              <td>{{ m.name }}</td>
              <td class="num">{{ m.value }}</td>
            </tr>
          </tbody>
        </table>
        <div v-else class="ts-faint q-py-md">Not reported by this node.</div>
      </section>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue';
import prettyBytes from 'pretty-bytes';
import { useNodeStore } from '@/stores/node';
import { useCollectionsStore } from '@/stores/collections';
import type { NodeLoginDataInterface } from '@/stores/node';
import PageHeader from '@/components/ui/PageHeader.vue';
import StatTile from '@/components/ui/StatTile.vue';
import MeterBar from '@/components/ui/Meter.vue';

interface Stats {
  total_requests_per_second?: number;
  search_requests_per_second?: number;
  search_latency_ms?: number;
  cache_hit_ratio?: number;
  latency_ms?: Record<string, number>;
  requests_per_second?: Record<string, number>;
}

const store = useNodeStore();
const collectionsStore = useCollectionsStore();
let refreshInterval: number | undefined;

const metrics = computed(() => store.data.metrics as Record<string, unknown>);
const stats = computed(() => (store.data.features.stats ? (store.data.stats as Stats) : null));

function num(key: string): number | null {
  const raw = metrics.value?.[key];
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? parseFloat(raw) : NaN;
  return Number.isFinite(n) ? n : null;
}

const numberFormat = new Intl.NumberFormat(undefined, {
  notation: 'compact',
  maximumFractionDigits: 1,
});
function compact(value: number, digits = 0) {
  return value < 1000 ? value.toFixed(digits).replace(/\.0$/, '') : numberFormat.format(value);
}

const hasMetrics = computed(() => Object.keys(metrics.value ?? {}).length > 0);
const cpu = computed(() => num('system_cpu_active_percentage'));

function pair(usedKey: string, totalKey: string) {
  const used = num(usedKey);
  const total = num(totalKey);
  return used !== null && total ? { used, total } : null;
}
const memory = computed(() => pair('system_memory_used_bytes', 'system_memory_total_bytes'));
const disk = computed(() => pair('system_disk_used_bytes', 'system_disk_total_bytes'));

const network = computed(() => {
  const received = num('system_network_received_bytes');
  const sent = num('system_network_sent_bytes');
  return received === null || sent === null
    ? null
    : { received: prettyBytes(received), sent: prettyBytes(sent) };
});

const cores = computed(() =>
  Object.entries(metrics.value ?? {})
    .filter(([key]) => /^system_cpu\d+_active_percentage$/.test(key))
    .map(([key, value]) => ({
      node: parseInt(key.replace('system_cpu', ''), 10) || 0,
      value: parseFloat(String(value)),
    }))
    .filter((c) => Number.isFinite(c.value))
    .sort((a, b) => a.node - b.node),
);

const typesenseMemory = computed(() =>
  Object.entries(metrics.value ?? {})
    .filter(([key]) => key.startsWith('typesense_memory_'))
    .map(([key, value]) => {
      const name = key
        .replace('typesense_memory_', '')
        .replace(/_bytes$/, '')
        .replace(/_/g, ' ');
      const n = parseFloat(String(value));
      return {
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value: key.endsWith('_bytes') && Number.isFinite(n) ? prettyBytes(n) : String(value),
      };
    }),
);

const endpoints = computed(() => {
  const rps = stats.value?.requests_per_second ?? {};
  const latency = stats.value?.latency_ms ?? {};
  return Object.keys({ ...rps, ...latency })
    .map((name) => ({ name, rps: rps[name] ?? 0, latency: latency[name] ?? 0 }))
    .sort((a, b) => b.rps - a.rps);
});

const totalDocuments = computed(() =>
  collectionsStore.collections.reduce((sum, c) => sum + (c.num_documents ?? 0), 0),
);

const healthClass = computed(() => {
  if (!store.data.features.health) return 'is-unknown';
  return store.data.health?.ok ? 'is-ok' : 'is-bad';
});
const healthLabel = computed(() => {
  if (!store.data.features.health) return 'Health unknown';
  return store.data.health?.ok ? 'Healthy' : 'Not healthy';
});

const address = computed(() => {
  const node = store.loginData?.node;
  return node ? `${node.protocol}://${node.host}:${node.port}${node.path ?? ''}` : '';
});

const role = computed(() => {
  const state = store.data.debug?.state;
  if (state === 1) return 'Leader';
  if (state === 4) return 'Follower';
  return state === undefined ? '—' : `State ${String(state)}`;
});

const connectionTimeoutDisplay = computed(() => {
  const timeout = store.loginData?.connectionTimeoutSeconds;
  return timeout !== undefined ? `${timeout} s` : 'Default';
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

onMounted(() => {
  store.refreshServerStatus();
  refreshInterval = window.setInterval(() => store.refreshServerStatus(), 2000);
});

onBeforeUnmount(() => window.clearInterval(refreshInterval));
</script>

<style scoped lang="scss">
.health {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
  color: var(--ts-ink);
}

.health__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ts-ink-3);
  .is-ok & {
    background: var(--q-positive);
  }
  .is-bad & {
    background: var(--q-negative);
  }
}

.kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.grid {
  display: grid;
  grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
  gap: 16px;
  align-items: start;
  @media (max-width: 1023px) {
    grid-template-columns: 1fr;
  }
}

.card {
  padding: 18px 20px;
}

.meters {
  display: grid;
  gap: 18px;
}

.cores {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(26px, 1fr));
  gap: 6px;
}

.core {
  display: grid;
  justify-items: center;
  gap: 4px;
}

.core__track {
  position: relative;
  width: 100%;
  height: 44px;
  border-radius: 4px;
  background: var(--ts-primary-soft);
  overflow: hidden;
}

.core__fill {
  position: absolute;
  inset: auto 0 0;
  border-radius: 4px;
  background: var(--ts-primary);
  transition: height 0.4s ease;
}

.core__label {
  font-family: var(--ts-font-mono);
  font-size: 0.68rem;
  color: var(--ts-ink-3);
}

.network {
  display: flex;
  gap: 20px;
  margin-top: 18px;
  font-size: 0.85rem;
  color: var(--ts-ink-2);
}

.facts {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 8px 16px;
  margin: 0;
  font-size: 0.9rem;
  dt {
    color: var(--ts-ink-3);
  }
  dd {
    margin: 0;
    color: var(--ts-ink);
    word-break: break-all;
  }
}

.cluster {
  border: 1px solid var(--ts-rule);
  border-radius: 8px;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
  th {
    text-align: left;
    font-weight: 500;
    font-size: 0.75rem;
    color: var(--ts-ink-3);
    padding: 6px 0;
    border-bottom: 1px solid var(--ts-rule);
  }
  td {
    padding: 8px 0;
    border-bottom: 1px solid var(--ts-rule);
    color: var(--ts-ink);
  }
  tr:last-child td {
    border-bottom: 0;
  }
  .num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
}
</style>
