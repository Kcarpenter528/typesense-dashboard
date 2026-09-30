<template>
  <q-page padding>
    <div class="row items-center q-mb-md q-gutter-sm">
      <q-icon name="sym_s_settings" size="md" />
      <div class="text-h5">Server settings</div>
      <q-chip v-if="nodeLabel" dense outline icon="sym_s_dns">{{ nodeLabel }}</q-chip>
    </div>

    <q-banner v-if="writesSkipped" rounded class="bg-negative text-white q-mb-md">
      <template #avatar><q-icon name="sym_s_block" /></template>
      "Reject all writes" was turned on for this node from this browser. Every write fails until it
      is turned off again under Runtime settings, or the server restarts.
    </q-banner>

    <div class="row q-col-gutter-md">
      <div class="col-12 col-lg-7">
        <runtime-settings-card />
      </div>
      <div class="col-12 col-lg-5">
        <operations-card />
      </div>
      <div class="col-12">
        <startup-config-card />
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useNodeStore } from '@/stores/node';
import { nodeId } from '@/shared/nodePrefs';
import { useRuntimeHistory } from '@/shared/useRuntimeHistory';
import RuntimeSettingsCard from '@/components/settings/RuntimeSettingsCard.vue';
import OperationsCard from '@/components/settings/OperationsCard.vue';
import StartupConfigCard from '@/components/settings/StartupConfigCard.vue';

const store = useNodeStore();
const { applied } = useRuntimeHistory();

const nodeLabel = computed(() => (store.loginData ? nodeId(store.loginData.node) : ''));
const writesSkipped = computed(() => applied.value['skip-writes']?.value === true);
</script>
