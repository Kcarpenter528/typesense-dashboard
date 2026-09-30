import type { AxiosResponse } from 'axios';
import type { DebugResponseSchema } from 'typesense/lib/Typesense/Debug';
import type { NodeConfiguration } from 'typesense/lib/Typesense/Configuration';
import type { RouteLocationNormalized } from 'vue-router';

import { LocalStorage, Notify } from 'quasar';
import { acceptHMRUpdate, defineStore } from 'pinia';
import { Api } from '@/shared/api';
import { isValidCollectionsPayload, useCollectionsStore } from './collections';
import { useAliasesStore } from './aliases';
import { useApiKeysStore } from './apiKeys';
import { useAnalyticsRulesStore } from './analyticsRules';
import { useSearchPresetsStore } from './searchPresets';
import { useStopwordsStore } from './stopwords';
import { useStemmingStore } from './stemming';
import { useSynonymsStore } from './synonyms';
import { useCurationsStore } from './curations';

/*
 * The connection to a Typesense node: login, server history, what the server reports
 * about itself (health, metrics, version, available features) and the shared error
 * banner. Each API area (collections, documents, aliases, keys, …) has its own store
 * next to this one and reaches the server through `useNodeStore().api`.
 */

export interface Health {
  ok: boolean;
  resource_error?: string;
}

export interface NodeDataInterface {
  debug: any;

  metrics: any;

  stats: any;

  health: Health | undefined;
  defaultDocVersion: string;
  features: {
    stopwords: boolean;
    stemmingDictionaries: boolean;
    analyticsRules: boolean;
    searchPresets: boolean;
    stats: boolean;
    aliases: boolean;
    apiKeys: boolean;
    debug: boolean;
    health: boolean;
    synonymSets: boolean;
    curationSets: boolean;
  };
}

export type FeatureKey = keyof NodeDataInterface['features'];

export interface CustomNodeConfiguration extends NodeConfiguration {
  tls: boolean;
}

export interface NodeLoginDataInterface {
  node: CustomNodeConfiguration;
  apiKey: string;
  clusterTag?: string;
  connectionTimeoutSeconds?: number;
}

export interface NodeLoginPayloadInterface extends NodeLoginDataInterface {
  forceHomeRedirect?: boolean;
}

export interface UIConfigInterface {
  hideProjectInfo?: boolean;
}

export interface NodeStateInterface {
  loginData: NodeLoginDataInterface | null;
  currentNodeConfig: CustomNodeConfiguration;
  loginHistory: string[];
  forceHomeRedirect: boolean;
  isConnected: boolean;
  previousRoute: RouteLocationNormalized | null;
  error: string | null;
  data: NodeDataInterface;
  uiConfig: UIConfigInterface;
}

export const STORAGE_KEY_LOGIN = 'typesense-logindata';
export const STORAGE_KEY_LOGIN_HISTORY = 'typesense-loginhistory';

function isValidMetricsPayload(payload: unknown): payload is Record<string, unknown> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  const keys = Object.keys(payload);
  if (keys.length === 0) return false;
  // Typesense metrics generally contain system_* and/or typesense_* keys.
  return keys.some((k) => k.startsWith('system_') || k.startsWith('typesense_'));
}

function state(): NodeStateInterface {
  const storedLoginDataRaw = LocalStorage.getItem(STORAGE_KEY_LOGIN);
  const storedLoginData: NodeLoginDataInterface | null =
    storedLoginDataRaw && typeof storedLoginDataRaw === 'object'
      ? (storedLoginDataRaw as NodeLoginDataInterface)
      : null;
  const defaultNodeConfig: CustomNodeConfiguration = {
    host: 'localhost',
    port: 8108,
    protocol: 'http',
    path: '',
    tls: true,
  };
  return {
    loginData: storedLoginData,
    currentNodeConfig: (storedLoginData?.node as CustomNodeConfiguration) || defaultNodeConfig,
    loginHistory: LocalStorage.getItem(STORAGE_KEY_LOGIN_HISTORY) || [],
    forceHomeRedirect: false,
    isConnected: false,
    previousRoute: null,
    error: null,
    uiConfig: {
      hideProjectInfo: false,
    },
    data: {
      debug: {},
      metrics: {},
      stats: {},
      health: undefined,
      defaultDocVersion: '28.0',
      features: {
        stopwords: false,
        stemmingDictionaries: false,
        analyticsRules: false,
        searchPresets: false,
        stats: false,
        aliases: false,
        apiKeys: false,
        debug: false,
        health: false,
        synonymSets: false,
        curationSets: false,
      },
    },
  };
}

export const useNodeStore = defineStore('node', {
  state,
  getters: {
    typesenseMajorVersion(): number {
      const version = this.data.debug?.version;
      if (!version || typeof version !== 'string') return 0;
      const major = parseInt(version.split('.')[0] ?? '0', 10);
      return Number.isNaN(major) ? 0 : major;
    },
    supportsCurationRuleTags(): boolean {
      return this.typesenseMajorVersion >= 26;
    },
    api(state): Api | void {
      if (state.loginData && state.loginData.apiKey) {
        const electron: Api | null = (window as any).electron;
        let api = new Api();
        if (electron) {
          api = electron;
          (electron as any).rejectTLS(Number(state.loginData.node.tls));
        }
        const initConfig: Parameters<typeof api.init>[0] = {
          node: { ...state.loginData.node },
          apiKey: state.loginData.apiKey,
        };
        if (state.loginData.connectionTimeoutSeconds !== undefined) {
          initConfig.connectionTimeoutSeconds = state.loginData.connectionTimeoutSeconds;
        }
        api.init(initConfig);
        return api;
      }
    },
    loginHistoryParsed(state): NodeLoginDataInterface[] {
      const parsed: NodeLoginDataInterface[] = [];
      for (const raw of state.loginHistory) {
        if (typeof raw !== 'string') continue;
        try {
          const item = JSON.parse(raw) as NodeLoginDataInterface;
          if (item && item.node && item.apiKey) parsed.push(item);
        } catch {
          /* ignore malformed */
        }
      }
      return parsed;
    },
    currentHistoryEntry(): NodeLoginDataInterface | null {
      if (!this.loginData) return null;
      const baseKey = JSON.stringify({ node: this.loginData.node, apiKey: this.loginData.apiKey });
      for (const item of this.loginHistoryParsed) {
        const key = JSON.stringify({ node: item.node, apiKey: item.apiKey });
        if (key === baseKey) return item;
      }
      return null;
    },
    currentClusterTag(): string | null {
      return this.currentHistoryEntry?.clusterTag || null;
    },
    clusterMembersForCurrent(): NodeLoginDataInterface[] {
      const tag = this.currentClusterTag;
      if (!tag) return [];
      return this.loginHistoryParsed
        .filter((h) => h.clusterTag === tag)
        .slice()
        .sort((a, b) => {
          const h = a.node.host.localeCompare(b.node.host);
          if (h !== 0) return h;
          const pa = Number(a.node.port || 0);
          const pb = Number(b.node.port || 0);
          if (pa !== pb) return pa - pb;
          return String(a.node.protocol).localeCompare(String(b.node.protocol));
        });
    },
  },
  actions: {
    async connectionCheck() {
      if (!this.loginData) {
        this.setIsConnected(false);
        return;
      }

      // Metrics are optional; only store them when valid.
      try {
        const response = await this.api?.get('/metrics.json');
        if (response && isValidMetricsPayload(response.data)) {
          this.setData({ metrics: response.data });
        } else {
          this.setData({ metrics: {} });
        }
      } catch {
        this.setData({ metrics: {} });
      }

      try {
        // Minimal required data to consider the connection successful.
        const collections = await this.api?.getCollections();
        if (!isValidCollectionsPayload(collections)) {
          throw new Error('Invalid collections response');
        }
        useCollectionsStore().collections = collections;

        // Optional features depending on the apiKey and server capabilities.
        // A feature is available when its first load succeeds.
        const probes: [FeatureKey, () => Promise<unknown>][] = [
          ['aliases', () => useAliasesStore().load()],
          ['searchPresets', () => useSearchPresetsStore().load()],
          ['analyticsRules', () => useAnalyticsRulesStore().load()],
          ['stopwords', () => useStopwordsStore().load()],
          ['stemmingDictionaries', () => useStemmingStore().load()],
          ['apiKeys', () => useApiKeysStore().load()],
          ['debug', () => this.getDebug()],
          ['synonymSets', () => useSynonymsStore().fetchSets()],
          ['curationSets', () => useCurationsStore().fetchSets()],
        ];
        for (const [key, probe] of probes) {
          probe().then(
            () => this.setFeature({ key, value: true }),
            () => this.setFeature({ key, value: false }),
          );
        }

        this.setIsConnected(true);
        this.saveHistory();
        this.setError(null);
      } catch (error: unknown) {
        this.setIsConnected(false);
        this.setError((error as Error).message || String(error));
      }
    },
    refreshServerStatus() {
      // Metrics are optional; update if valid, otherwise clear so UI can hide them.
      void this.api
        ?.get('/metrics.json')
        ?.then((response: AxiosResponse) => {
          if (isValidMetricsPayload(response.data)) {
            this.setData({ metrics: response.data });
          } else {
            this.setData({ metrics: {} });
          }
        })
        .catch(() => {
          this.setData({ metrics: {} });
        });
      this.api
        ?.get('/health')
        ?.then((response: AxiosResponse) => {
          this.setData({ health: response.data });
          this.setFeature({
            key: 'health',
            value: true,
          });
        })
        .catch(() => {
          this.setFeature({ key: 'health', value: false });
        });
      this.api
        ?.get('/stats.json')
        ?.then((response: AxiosResponse) => {
          this.setData({
            stats: response.data,
          });
          if (!this.data.features.stats) {
            this.setFeature({
              key: 'stats',
              value: true,
            });
          }
        })
        .catch(() => {
          this.setFeature({
            key: 'stats',
            value: false,
          });
        });
    },
    async getDebug() {
      await this.api?.getDebug()?.then((response: DebugResponseSchema) => {
        this.setData({
          debug: response,
        });
      });
    },
    login(loginData: NodeLoginPayloadInterface) {
      const { apiKey, node, forceHomeRedirect = false, connectionTimeoutSeconds } = loginData;
      let { clusterTag } = loginData;
      // Recover clusterTag from history if not provided
      if (!clusterTag) {
        try {
          const targetKey = JSON.stringify({ node, apiKey });
          for (const item of this.loginHistoryParsed) {
            const key = JSON.stringify({ node: item.node, apiKey: item.apiKey });
            if (key === targetKey && item.clusterTag) {
              clusterTag = item.clusterTag;
              break;
            }
          }
        } catch {
          /* ignore */
        }
      }
      this.setForceRedirect(forceHomeRedirect);
      this.setCurrentNodeConfig(node);
      const nodeData: NodeLoginDataInterface = { apiKey, node };
      if (clusterTag !== undefined) {
        nodeData.clusterTag = clusterTag;
      }
      if (connectionTimeoutSeconds !== undefined) {
        nodeData.connectionTimeoutSeconds = connectionTimeoutSeconds;
      }
      this.setNodeData(nodeData);
      void this.connectionCheck();
    },
    logout() {
      LocalStorage.remove(STORAGE_KEY_LOGIN);
      this.setNodeData(null);
      useCollectionsStore().setCurrentCollection(null);
      this.setIsConnected(false);
    },
    isCurrent(member: NodeLoginDataInterface): boolean {
      return JSON.stringify(this.loginData) === JSON.stringify(member);
    },
    setNodeData(payload: NodeLoginDataInterface | null): void {
      this.loginData = payload;
      LocalStorage.set(STORAGE_KEY_LOGIN, payload);
    },
    setCurrentNodeConfig(config: Partial<CustomNodeConfiguration>): void {
      const merged: CustomNodeConfiguration = {
        ...this.currentNodeConfig,
        ...(config as CustomNodeConfiguration),
      };

      if (!merged.protocol) merged.protocol = 'http';
      if (!merged.host) merged.host = 'localhost';
      const port = Number(merged.port);
      merged.port = Number.isFinite(port) ? port : 8108;
      if (merged.path == null) merged.path = '';
      if (typeof merged.tls !== 'boolean') merged.tls = true;

      this.currentNodeConfig = merged;
    },
    setIsConnected(status: boolean): void {
      const route = this.router.currentRoute.value;
      if (status && !this.isConnected) {
        if (this.previousRoute) {
          void this.router.push(this.previousRoute);
          this.previousRoute = null;
        } else {
          void this.router.push('/');
        }
      }
      if (!status && route?.name !== 'Login') {
        void this.router.push('/login');
      }
      if (status && this.forceHomeRedirect) {
        void this.router.push('/');
        Notify.create({
          position: 'top',
          progress: true,
          group: false,
          timeout: 1000,
          color: 'positive',
          message: 'Server changed',
        });
        this.forceHomeRedirect = false;
        useCollectionsStore().currentCollection = null;
      }
      this.isConnected = status;
    },
    saveHistory(): void {
      const currentLoginDataJson = JSON.stringify(this.loginData);
      const index = this.loginHistory.indexOf(currentLoginDataJson);
      if (index === 0) return;
      if (index > 0) {
        this.loginHistory.splice(index, 1);
      }
      this.loginHistory.unshift(currentLoginDataJson);
      // cleanup remove duplicates without custom tags and preserve custom tags
      // Strategy:
      // - Consider duplicates based on { node, apiKey } only (ignore clusterTag for identity)
      // - Keep at most one entry per identity
      // - Prefer a tagged entry over an untagged one; if an untagged was kept earlier,
      //   replace it when we encounter a tagged duplicate
      // - If a tagged entry already exists for an identity, drop subsequent duplicates
      try {
        const cleaned: string[] = [];
        const keptPosByKey = new Map<string, number>();
        const hasTaggedByKey = new Map<string, boolean>();

        for (const raw of this.loginHistory) {
          if (typeof raw !== 'string') continue;
          let parsed: NodeLoginDataInterface | null = null;
          try {
            parsed = JSON.parse(raw) as NodeLoginDataInterface;
          } catch {
            // ignore malformed entries
            continue;
          }
          if (!parsed || !parsed.node || !parsed.apiKey) continue;

          const identityKey = JSON.stringify({ node: parsed.node, apiKey: parsed.apiKey });
          const hasTag = Boolean(parsed.clusterTag && String(parsed.clusterTag).length > 0);

          if (!keptPosByKey.has(identityKey)) {
            cleaned.push(raw);
            keptPosByKey.set(identityKey, cleaned.length - 1);
            hasTaggedByKey.set(identityKey, hasTag);
            continue;
          }

          const alreadyTagged = hasTaggedByKey.get(identityKey) === true;
          if (alreadyTagged) {
            // We already kept a tagged entry for this identity; drop duplicates
            continue;
          }

          // We only have an untagged kept so far
          if (hasTag) {
            // Replace previously kept untagged with this tagged one
            const pos = keptPosByKey.get(identityKey)!;
            cleaned[pos] = raw;
            hasTaggedByKey.set(identityKey, true);
          }
          // else: both untagged duplicates -> drop current
        }

        this.loginHistory = cleaned;
      } catch {
        // If anything goes wrong during cleanup, keep the current list as-is
      }
      LocalStorage.set(STORAGE_KEY_LOGIN_HISTORY, this.loginHistory);
    },
    clearHistory(): void {
      this.loginHistory = [];
      LocalStorage.set(STORAGE_KEY_LOGIN_HISTORY, []);
    },
    removeHistoryAt(index: number): void {
      if (index >= 0 && index < this.loginHistory.length) {
        this.loginHistory.splice(index, 1);
        LocalStorage.set(STORAGE_KEY_LOGIN_HISTORY, this.loginHistory);
      }
    },
    setHistoryTag(index: number, tag: string): void {
      if (index < 0 || index >= this.loginHistoryParsed.length) return;
      const parsed = this.loginHistoryParsed[index] as NodeLoginDataInterface;
      const updated: NodeLoginDataInterface = {
        node: parsed.node,
        apiKey: parsed.apiKey,
        clusterTag: tag,
      };
      if (parsed.connectionTimeoutSeconds !== undefined) {
        updated.connectionTimeoutSeconds = parsed.connectionTimeoutSeconds;
      }
      this.loginHistory.splice(index, 1, JSON.stringify(updated));
      LocalStorage.set(STORAGE_KEY_LOGIN_HISTORY, this.loginHistory);
      if (this.loginData) {
        this.loginData.clusterTag = tag;
      }
    },
    removeHistoryTag(index: number): void {
      if (index < 0 || index >= this.loginHistoryParsed.length) return;
      const base = this.loginHistoryParsed[index] as NodeLoginDataInterface;
      const noTag: NodeLoginDataInterface = { node: base.node, apiKey: base.apiKey };
      if (base.connectionTimeoutSeconds !== undefined) {
        noTag.connectionTimeoutSeconds = base.connectionTimeoutSeconds;
      }
      this.loginHistory.splice(index, 1, JSON.stringify(noTag));
      LocalStorage.set(STORAGE_KEY_LOGIN_HISTORY, this.loginHistory);
      if (this.loginData) {
        delete this.loginData.clusterTag;
      }
    },
    setForceRedirect(value: boolean): void {
      this.forceHomeRedirect = value;
    },
    setPreviousRoute(route: RouteLocationNormalized): void {
      this.previousRoute = route;
    },
    setData(data: Partial<NodeDataInterface>): void {
      Object.assign(this.data, data);
    },
    setFeature(data: { key: FeatureKey; value: boolean }): void {
      this.data.features[data.key] = data.value;
    },
    setError(error: string | null): void {
      this.error = error;
    },
    setUIConfig(config: UIConfigInterface): void {
      this.uiConfig = { ...this.uiConfig, ...config };
    },
  },
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useNodeStore, import.meta.hot));
}
