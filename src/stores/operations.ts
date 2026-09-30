import { Notify } from 'quasar';
import { acceptHMRUpdate, defineStore } from 'pinia';
import { useNodeStore } from './node';

export interface NodeStatus {
  state: string;
  committed_index?: number;
  queued_writes?: number;
}

export interface SchemaChangeStatus {
  collection: string;
  validated_docs?: number;
  altered_docs?: number;
}

function notifySuccess(message: string, timeout = 1000) {
  Notify.create({
    position: 'top',
    progress: true,
    group: false,
    timeout,
    color: 'positive',
    message,
  });
}

/** Server operations and runtime settings. Holds no state; every call goes to the server. */
export const useOperationsStore = defineStore('operations', {
  actions: {
    async compactDB() {
      const node = useNodeStore();
      try {
        node.setError(null);
        const response = await node.api?.post('/operations/db/compact');
        if (response?.data?.success) notifySuccess('Compact DB: Server responded with success');
      } catch (error) {
        node.setError((error as Error).message);
      }
    },
    async clearCache() {
      const node = useNodeStore();
      try {
        node.setError(null);
        const response = await node.api?.post('/operations/cache/clear');
        if (response?.data?.success) notifySuccess('Clear Cache: Server responded with success');
      } catch (error) {
        node.setError((error as Error).message);
      }
    },
    async createSnapshot(snapshotPath: string) {
      const node = useNodeStore();
      try {
        node.setError(null);
        const response = await node.api?.createSnapshot(snapshotPath);
        if (response?.success) {
          notifySuccess(`Snapshot created successfully at: ${snapshotPath}`, 3000);
        }
      } catch (error) {
        node.setError((error as Error).message);
      }
    },
    /**
     * Changes a setting on the running node via `POST /config`. The change applies to
     * this node only and is lost when it restarts. Resolves with an error message, or null.
     */
    async setRuntimeConfig(key: string, value: number | boolean): Promise<string | null> {
      try {
        const response = await useNodeStore().api?.post('/config', { [key]: value });
        return response?.data?.success ? null : 'The server did not confirm the change';
      } catch (error) {
        return (error as Error).message;
      }
    },
    /** Raft state of this node (undocumented endpoint; null when unavailable). */
    async getNodeStatus(): Promise<NodeStatus | null> {
      try {
        const response = await useNodeStore().api?.get('/status');
        return (response?.data as NodeStatus | undefined) ?? null;
      } catch {
        return null;
      }
    },
    /** Schema changes still being applied (undocumented endpoint; null when unavailable). */
    async getSchemaChanges(): Promise<SchemaChangeStatus[] | null> {
      try {
        const data: unknown = (await useNodeStore().api?.get('/operations/schema_changes'))?.data;
        return Array.isArray(data) ? (data as SchemaChangeStatus[]) : [];
      } catch {
        return null;
      }
    },
    /** Asks this node to give up leadership so the cluster elects a new leader. */
    async triggerLeaderElection(): Promise<boolean> {
      const node = useNodeStore();
      try {
        const response = await node.api?.post('/operations/vote');
        return response?.data?.success === true;
      } catch (error) {
        node.setError((error as Error).message);
        return false;
      }
    },
  },
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useOperationsStore, import.meta.hot));
}
