import type { NLSearchModelSchema } from 'typesense/lib/Typesense/NLSearchModels';
import type { ConversationModelSchema } from 'typesense/lib/Typesense/ConversationModel';
import { acceptHMRUpdate, defineStore } from 'pinia';
import type { ModelKind } from '@/shared/aiModels';
import { serverMessage } from '@/shared/errors';
import { useNodeStore } from './node';

/**
 * LLM connections: natural-language search models (turn a plain-language query into
 * search parameters) and conversation models (answer questions from search results).
 */
export const useAiModelsStore = defineStore('aiModels', {
  state: () => ({
    nlModels: [] as NLSearchModelSchema[],
    conversationModels: [] as ConversationModelSchema[],
  }),
  actions: {
    async loadNl() {
      const response = await useNodeStore().api?.getNlSearchModels();
      if (response) this.nlModels = sortById(response);
    },
    async loadConversation() {
      const response = await useNodeStore().api?.getConversationModels();
      if (response) this.conversationModels = sortById(response);
    },
    load(kind: ModelKind) {
      return kind === 'nl' ? this.loadNl() : this.loadConversation();
    },
    models(kind: ModelKind): { id: string; model_name: string }[] {
      return kind === 'nl' ? this.nlModels : this.conversationModels;
    },
    /** Creates or updates a model. Resolves with an error message, or null on success. */
    async save(
      kind: ModelKind,
      payload: Record<string, unknown>,
      existingId?: string,
    ): Promise<string | null> {
      const api = useNodeStore().api;
      try {
        if (kind === 'nl') {
          if (existingId) await api?.updateNlSearchModel(existingId, payload as never);
          else await api?.createNlSearchModel(payload as never);
        } else if (existingId) {
          await api?.updateConversationModel(existingId, payload as never);
        } else {
          await api?.createConversationModel(payload as never);
        }
        await this.load(kind);
        return null;
      } catch (error) {
        return serverMessage(error);
      }
    },
    async remove(kind: ModelKind, id: string) {
      const node = useNodeStore();
      try {
        node.setError(null);
        if (kind === 'nl') await node.api?.deleteNlSearchModel(id);
        else await node.api?.deleteConversationModel(id);
      } catch (error) {
        node.setError((error as Error).message);
      }
      await this.load(kind);
    },
  },
});

function sortById<T extends { id: string }>(models: T[]): T[] {
  return [...models].sort((a, b) => a.id.localeCompare(b.id));
}

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAiModelsStore, import.meta.hot));
}
