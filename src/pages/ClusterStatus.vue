<template>
  <q-page class="ts-page">
    <page-header
      help="clusters"
      title="Cluster"
      description="Each node of the cluster this server belongs to. Switch to a node to manage it directly."
    />

    <div v-if="!store.currentClusterTag" class="ts-sheet">
      <empty-state
        icon="sym_s_hub"
        title="This server isn't part of a cluster here"
        body="Group servers into a cluster by giving them the same cluster tag in your recent servers (the server menu at the top right)."
      />
    </div>

    <div v-else class="row q-col-gutter-md">
      <div
        v-for="(entry, idx) in store.clusterMembersForCurrent"
        :key="idx"
        class="col-12 col-md-6 col-lg-4"
      >
        <NodeStatusCard :entry="entry" :is-current="isCurrent(entry)" @connect="connect(entry)" />
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { useNodeStore } from '@/stores/node';
import type { NodeLoginDataInterface } from '@/stores/node';
import NodeStatusCard from '../components/NodeStatusCard.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import EmptyState from '@/components/ui/EmptyState.vue';

const store = useNodeStore();

function isCurrent(entry: NodeLoginDataInterface) {
  const login = store.loginData;
  if (!login) return false;
  const ak = String(login.apiKey) === String(entry.apiKey);
  const sameNode = JSON.stringify(login.node) === JSON.stringify(entry.node);
  return ak && sameNode;
}

function connect(entry: NodeLoginDataInterface) {
  // Do not redirect to home from the cluster page
  const payload: Parameters<typeof store.login>[0] = {
    node: entry.node,
    apiKey: entry.apiKey,
  };
  if (entry.connectionTimeoutSeconds !== undefined) {
    payload.connectionTimeoutSeconds = entry.connectionTimeoutSeconds;
  }
  store.login(payload);
}
</script>
