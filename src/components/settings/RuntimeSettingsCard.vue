<template>
  <q-card flat bordered>
    <q-card-section>
      <div class="row items-center q-gutter-sm">
        <q-icon name="sym_s_tune" size="sm" />
        <div class="text-h6">Runtime settings</div>
      </div>
      <p class="text-grey-8 q-mt-sm q-mb-none">
        Applied immediately to the node you are connected to, and lost when it restarts. To keep a
        value, also add it to the startup configuration below.
      </p>
      <p class="text-caption text-grey-7 q-mt-xs q-mb-none">
        Typesense does not report the current values. Each field starts at the value last applied
        from this browser, or at the default.
      </p>
    </q-card-section>

    <template v-for="[group, settings] in groups" :key="group">
      <q-separator />
      <q-card-section class="q-py-sm">
        <div class="text-overline text-grey-7">{{ group }}</div>
        <div
          v-for="setting in settings"
          :key="setting.key"
          class="row items-start q-col-gutter-md q-py-sm"
        >
          <div class="col-12 col-sm-7">
            <div class="text-body2 text-weight-medium">
              {{ setting.label }}
              <code class="text-caption text-grey-7 q-ml-xs">{{ setting.key }}</code>
            </div>
            <div class="text-caption text-grey-8">{{ setting.description }}</div>
            <div class="text-caption text-grey-7">
              Default {{ formatValue(setting, setting.default) }}
              <template v-if="applied[setting.key]">
                · Set to
                <span class="text-weight-medium">
                  {{ formatValue(setting, applied[setting.key]!.value) }}
                </span>
                {{ timeAgo(applied[setting.key]!.at) }}
              </template>
            </div>
          </div>
          <div class="col-12 col-sm-5 row no-wrap items-start justify-end q-gutter-sm">
            <q-input
              v-if="setting.type === 'number'"
              :model-value="drafts[setting.key] as number"
              class="col"
              dense
              outlined
              type="number"
              :suffix="setting.unit"
              :aria-label="setting.label"
              :error="!!errors[setting.key]"
              :error-message="errors[setting.key] ?? undefined"
              @update:model-value="setNumberDraft(setting.key, $event)"
              @keyup.enter="apply(setting)"
            />
            <q-toggle
              v-else
              v-model="drafts[setting.key]"
              class="col"
              :color="setting.danger ? 'negative' : 'primary'"
              :label="drafts[setting.key] ? 'On' : 'Off'"
              :aria-label="setting.label"
            />
            <q-btn
              unelevated
              no-caps
              :color="
                setting.danger && drafts[setting.key] !== setting.default ? 'negative' : 'primary'
              "
              label="Apply"
              :loading="saving[setting.key]"
              :disable="!!errors[setting.key]"
              @click="apply(setting)"
            />
          </div>
        </div>
      </q-card-section>
    </template>
  </q-card>
</template>

<script setup lang="ts">
import { computed, reactive } from 'vue';
import { useQuasar } from 'quasar';
import { useNodeStore } from '@/stores/node';
import { groupBy, RUNTIME_SETTINGS, validateRuntimeValue } from '@/shared/serverConfig';
import type { RuntimeSetting } from '@/shared/serverConfig';
import { useRuntimeHistory } from '@/shared/useRuntimeHistory';

const $q = useQuasar();
const store = useNodeStore();
const { applied, record } = useRuntimeHistory();

const groups = groupBy(RUNTIME_SETTINGS);

const drafts = reactive<Record<string, number | boolean>>(
  Object.fromEntries(
    RUNTIME_SETTINGS.map((s) => [s.key, applied.value[s.key]?.value ?? s.default]),
  ),
);
const saving = reactive<Record<string, boolean>>({});

const errors = computed<Record<string, string | null>>(() =>
  Object.fromEntries(RUNTIME_SETTINGS.map((s) => [s.key, validateRuntimeValue(s, drafts[s.key])])),
);

function setNumberDraft(key: string, value: string | number | null) {
  // An empty field becomes NaN so validation reports it instead of silently sending 0.
  drafts[key] = value === '' || value === null ? Number.NaN : Number(value);
}

function formatValue(setting: RuntimeSetting, value: number | boolean) {
  if (setting.type === 'boolean') return value ? 'on' : 'off';
  if (value === -1 && setting.min === -1) return 'off (-1)';
  return `${value}${setting.unit ? ` ${setting.unit}` : ''}`;
}

function timeAgo(at: number) {
  const minutes = Math.round((Date.now() - at) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return new Date(at).toLocaleDateString();
}

function apply(setting: RuntimeSetting) {
  const value = drafts[setting.key];
  if (value === undefined || errors.value[setting.key]) return;
  if (setting.danger && value !== setting.default) {
    $q.dialog({
      title: `${setting.label}?`,
      message: setting.danger,
      cancel: true,
      persistent: true,
      ok: { label: 'Apply', color: 'negative', unelevated: true },
    }).onOk(() => void send(setting, value));
    return;
  }
  void send(setting, value);
}

async function send(setting: RuntimeSetting, value: number | boolean) {
  saving[setting.key] = true;
  const error = await store.setRuntimeConfig(setting.key, value);
  saving[setting.key] = false;
  if (error) {
    $q.notify({ type: 'negative', position: 'top', message: `${setting.label}: ${error}` });
    return;
  }
  record(setting.key, value, value === setting.default);
  $q.notify({
    type: 'positive',
    position: 'top',
    timeout: 1500,
    message: `${setting.label} set to ${formatValue(setting, value)}`,
  });
}
</script>
