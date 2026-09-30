<template>
  <q-page class="ts-page">
    <page-header
      help="settings"
      title="Server settings"
      description="Change settings on the running server, run maintenance operations, and generate the startup configuration for settings such as CORS."
    />

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
import { useRuntimeHistory } from '@/shared/useRuntimeHistory';
import PageHeader from '@/components/ui/PageHeader.vue';
import RuntimeSettingsCard from '@/components/settings/RuntimeSettingsCard.vue';
import OperationsCard from '@/components/settings/OperationsCard.vue';
import StartupConfigCard from '@/components/settings/StartupConfigCard.vue';

const { applied } = useRuntimeHistory();

const writesSkipped = computed(() => applied.value['skip-writes']?.value === true);
</script>
