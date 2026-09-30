import type {
  AnalyticsRuleCreateSchema,
  AnalyticsRuleSchema,
} from 'typesense/lib/Typesense/AnalyticsRule';
import { acceptHMRUpdate, defineStore } from 'pinia';
import { useNodeStore } from './node';

export const useAnalyticsRulesStore = defineStore('analyticsRules', {
  state: () => ({
    rules: [] as AnalyticsRuleSchema[],
  }),
  actions: {
    async load() {
      const response = (await useNodeStore().api?.getAnalyticsRules()) as
        AnalyticsRuleSchema[] | { rules: AnalyticsRuleSchema[] } | undefined;
      // v30 returns a plain array; older servers wrap it in `{ rules }`.
      this.rules = Array.isArray(response) ? response : (response?.rules ?? []);
    },
    /** Loads the rules, showing any failure in the error banner instead of throwing. */
    async refresh() {
      try {
        await this.load();
      } catch (error) {
        useNodeStore().setError((error as Error).message);
        this.rules = [];
      }
    },
    async upsert(rule: AnalyticsRuleCreateSchema) {
      const node = useNodeStore();
      try {
        node.setError(null);
        await node.api?.upsertAnalyticsRule(rule.name, rule);
        void this.refresh();
      } catch (error) {
        node.setError((error as Error).message);
      }
    },
    async remove(name: string) {
      await useNodeStore().api?.deleteAnalyticsRule(name);
      void this.refresh();
    },
  },
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAnalyticsRulesStore, import.meta.hot));
}
