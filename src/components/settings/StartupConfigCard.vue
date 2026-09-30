<template>
  <q-card flat bordered>
    <q-card-section>
      <div class="row items-center q-gutter-sm">
        <q-icon name="sym_s_settings_applications" size="sm" />
        <div class="text-h6">Startup configuration</div>
      </div>
      <p class="text-grey-8 q-mt-sm q-mb-none">
        These settings, including CORS, are read only when Typesense starts. The API has no way to
        change them, so the dashboard can't apply them for you. Pick what you need, then use the
        generated configuration where you run Typesense and restart it.
      </p>
    </q-card-section>
    <q-separator />

    <q-card-section class="q-pb-none">
      <div class="text-overline text-grey-7">CORS</div>
      <q-banner
        rounded
        dense
        :class="[$q.dark.isActive ? 'bg-grey-9' : 'bg-blue-1 text-grey-9', 'q-mb-md']"
      >
        <template #avatar><q-icon name="sym_s_info" color="primary" /></template>
        This dashboard runs at <code>{{ dashboardOrigin }}</code
        >. It can only reach Typesense if CORS is enabled and this origin is allowed, or the allowed
        origins list is empty.
      </q-banner>
      <div class="row q-col-gutter-md items-start">
        <div class="col-12 col-md-4">
          <q-toggle v-model="values['enable-cors']" label="Enable CORS" />
        </div>
        <div class="col-12 col-md-8">
          <q-select
            v-model="values['cors-domains']"
            dense
            outlined
            multiple
            use-chips
            use-input
            hide-dropdown-icon
            new-value-mode="add-unique"
            input-debounce="0"
            label="Allowed origins"
            :disable="!values['enable-cors']"
            hint="e.g. https://app.example.com. Empty allows any origin."
          >
            <template #after>
              <q-btn
                flat
                dense
                no-caps
                size="sm"
                color="primary"
                label="Add this dashboard"
                :disable="!values['enable-cors'] || corsDomains.includes(dashboardOrigin)"
                @click="values['cors-domains'] = [...corsDomains, dashboardOrigin]"
              />
            </template>
          </q-select>
        </div>
      </div>
    </q-card-section>

    <q-card-section class="q-pt-md">
      <q-expansion-item
        v-for="[group, flags] in otherGroups"
        :key="group"
        dense
        switch-toggle-side
        header-class="q-px-none text-weight-medium"
        :label="group"
        :caption="groupSummary(flags)"
      >
        <div class="row q-col-gutter-md q-pb-md q-pt-sm">
          <div v-for="flag in flags" :key="flag.key" class="col-12 col-md-6">
            <div v-if="flag.type === 'boolean'" class="row no-wrap items-center">
              <q-toggle v-model="values[flag.key]" :label="flag.label" />
              <help-tip :topic="serverFlagTopic(flag)" />
            </div>
            <q-input
              v-else
              :model-value="inputValue(flag)"
              dense
              outlined
              :type="flag.type === 'number' ? 'number' : 'text'"
              :label="flag.label"
              :placeholder="'placeholder' in flag ? flag.placeholder : String(flag.default)"
              :suffix="'unit' in flag ? flag.unit : undefined"
              :hint="flag.description"
              @update:model-value="setValue(flag, $event)"
            >
              <template #append><help-tip :topic="serverFlagTopic(flag)" /></template>
            </q-input>
          </div>
        </div>
      </q-expansion-item>
      <div class="row items-center q-gutter-sm q-mt-sm">
        <q-btn
          flat
          dense
          no-caps
          color="primary"
          icon="sym_s_input"
          label="Include runtime settings applied from this browser"
          :disable="!runtimeFlagsToCopy.length"
          @click="copyRuntimeSettings"
        />
        <q-btn
          flat
          dense
          no-caps
          color="grey-8"
          icon="sym_s_restart_alt"
          label="Reset"
          @click="reset"
        />
      </div>
    </q-card-section>
    <q-separator />

    <q-card-section>
      <div class="text-overline text-grey-7">Deployment</div>
      <div class="row q-col-gutter-md">
        <q-input
          v-model="deployment.version"
          class="col-6 col-md-3"
          dense
          outlined
          label="Image version"
        />
        <q-input
          v-model.number="deployment.hostPort"
          class="col-6 col-md-3"
          dense
          outlined
          type="number"
          label="Host port"
        />
        <q-input
          v-model="deployment.dataDir"
          class="col-6 col-md-3"
          dense
          outlined
          label="Data directory"
        />
        <q-input
          v-model="deployment.containerName"
          class="col-6 col-md-3"
          dense
          outlined
          label="Container name"
        />
      </div>
    </q-card-section>

    <q-tabs
      v-model="format"
      dense
      no-caps
      align="left"
      active-color="primary"
      indicator-color="primary"
    >
      <q-tab v-for="f in formats" :key="f.name" :name="f.name" :label="f.label" />
    </q-tabs>
    <q-separator />
    <q-card-section>
      <div class="text-caption text-grey-8 q-mb-sm">{{ currentFormat.help }}</div>
      <div class="relative-position">
        <pre class="snippet q-ma-none q-pa-md">{{ snippet }}</pre>
        <q-btn
          class="absolute-top-right q-ma-sm"
          dense
          flat
          no-caps
          size="sm"
          icon="sym_s_content_copy"
          label="Copy"
          @click="copy"
        />
      </div>
      <div class="text-caption text-grey-7 q-mt-sm">
        The API key is never included. Set <code>TYPESENSE_API_KEY</code> in your environment or
        replace <code>{{ API_KEY_PLACEHOLDER }}</code
        >. Only settings that differ from the defaults are listed.
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import HelpTip from '@/components/help/HelpTip.vue';
import { serverFlagTopic } from '@/shared/help';
import { computed, reactive, ref, watch } from 'vue';
import { copyToClipboard, useQuasar } from 'quasar';
import { useNodeStore } from '@/stores/node';
import {
  API_KEY_PLACEHOLDER,
  changedFlags,
  groupBy,
  RUNTIME_SETTINGS,
  STARTUP_FLAGS,
  toConfigFile,
  toDockerCompose,
  toDockerRun,
  toEnvFile,
} from '@/shared/serverConfig';
import type { SettingValue, StartupFlag } from '@/shared/serverConfig';
import { readNodePref, writeNodePref } from '@/shared/nodePrefs';
import { useRuntimeHistory } from '@/shared/useRuntimeHistory';

const $q = useQuasar();
const store = useNodeStore();
const { applied } = useRuntimeHistory();

const PREF_NAME = 'startup-config';
const dashboardOrigin = window.location.origin;

function defaults(): Record<string, SettingValue> {
  return Object.fromEntries(STARTUP_FLAGS.map((f) => [f.key, f.default]));
}

// The dashboard can reach the server from this origin, so CORS is on and this origin allowed.
function initialValues(): Record<string, SettingValue> {
  return { ...defaults(), 'enable-cors': true };
}

const node = store.loginData?.node;
const values = reactive<Record<string, SettingValue>>({
  ...initialValues(),
  ...(node ? readNodePref<Record<string, SettingValue>>(PREF_NAME, node, {}) : {}),
});

const deployment = reactive({
  version: String(store.data.debug?.version ?? 'latest'),
  hostPort: Number(node?.port) || 8108,
  dataDir: '/data',
  containerName: 'typesense',
});

watch(
  values,
  (current) => {
    if (node) writeNodePref(PREF_NAME, node, changedFlags(current).length ? { ...current } : {});
  },
  { deep: true },
);

const corsDomains = computed(() => (values['cors-domains'] as string[] | undefined) ?? []);

const otherGroups = groupBy(STARTUP_FLAGS.filter((f) => f.group !== 'CORS'));

function groupSummary(flags: StartupFlag[]) {
  const keys = new Set(flags.map((f) => f.key));
  const changed = changedFlags(values).filter(([key]) => keys.has(key));
  return changed.length ? changed.map(([key, value]) => `${key}=${value}`).join(', ') : 'Defaults';
}

function inputValue(flag: StartupFlag): string | number {
  const value = values[flag.key];
  return typeof value === 'number' || typeof value === 'string' ? value : '';
}

function setValue(flag: StartupFlag, value: string | number | null) {
  if (flag.type === 'number') {
    values[flag.key] = value === '' || value === null ? flag.default : Number(value);
  } else {
    values[flag.key] = value === null ? '' : String(value);
  }
}

const runtimeFlagsToCopy = computed(() =>
  RUNTIME_SETTINGS.filter(
    (s) => applied.value[s.key] && STARTUP_FLAGS.some((f) => f.key === s.key),
  ),
);

function copyRuntimeSettings() {
  for (const setting of runtimeFlagsToCopy.value) {
    values[setting.key] = applied.value[setting.key]!.value;
  }
  $q.notify({
    position: 'top',
    timeout: 1500,
    message: `Added ${runtimeFlagsToCopy.value.map((s) => s.key).join(', ')}`,
  });
}

function reset() {
  Object.assign(values, initialValues());
}

const formats = [
  {
    name: 'compose',
    label: 'Docker Compose',
    help: 'docker-compose.yml. Put TYPESENSE_API_KEY in a .env file next to it.',
    render: toDockerCompose,
  },
  {
    name: 'run',
    label: 'docker run',
    help: 'Shell command. Stop and remove the old container first; the named volume keeps your data.',
    render: toDockerRun,
  },
  {
    name: 'env',
    label: 'Environment variables',
    help: 'For an --env-file, a Kubernetes ConfigMap, or any host that sets environment variables.',
    render: toEnvFile,
  },
  {
    name: 'ini',
    label: 'Config file',
    help: 'typesense-server.ini, passed with --config=/path/to/typesense-server.ini.',
    render: toConfigFile,
  },
];
const format = ref('compose');
const currentFormat = computed(() => formats.find((f) => f.name === format.value) ?? formats[0]!);

const snippet = computed(() =>
  currentFormat.value.render({
    values,
    version: deployment.version || 'latest',
    dataDir: deployment.dataDir || '/data',
    hostPort: deployment.hostPort || 8108,
    containerName: deployment.containerName || 'typesense',
  }),
);

function copy() {
  copyToClipboard(snippet.value)
    .then(() => $q.notify({ position: 'top', timeout: 1200, message: 'Copied' }))
    .catch(() =>
      $q.notify({ type: 'negative', position: 'top', message: 'Could not copy to the clipboard' }),
    );
}
</script>

<style scoped>
.snippet {
  background: rgba(127, 127, 127, 0.1);
  border-radius: 4px;
  font-size: 12px;
  overflow-x: auto;
  white-space: pre;
}
</style>
