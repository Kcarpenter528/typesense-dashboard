import type { AxiosInstance } from 'axios';
import axios from 'axios';
import * as Typesense from 'typesense';
import type { CollectionAliasSchema } from 'typesense/lib/Typesense/Aliases';
import type { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';
import type { CollectionUpdateSchema } from 'typesense/lib/Typesense/Collection';
import type {
  ConfigurationOptions,
  NodeConfiguration,
} from 'typesense/lib/Typesense/Configuration';
import type { SearchParams } from 'typesense/lib/Typesense/Documents';
import type { KeyCreateSchema } from 'typesense/lib/Typesense/Key';
import type { OverrideCreateSchema } from 'typesense/lib/Typesense/Overrides';
import type { SynonymSchema } from 'typesense/lib/Typesense/Synonym';
import type { PresetCreateSchema } from 'typesense/lib/Typesense/Presets';
import type { StopwordCreateSchema } from 'typesense/lib/Typesense/Stopwords';
import type { AnalyticsRuleUpsertSchema } from 'typesense/lib/Typesense/AnalyticsRule';
import type {
  SynonymItemSchema,
  SynonymSetCreateSchema,
} from 'typesense/lib/Typesense/SynonymSets';
import type {
  CurationObjectSchema,
  CurationSetUpsertSchema,
} from 'typesense/lib/Typesense/CurationSets';
import type {
  NLSearchModelBase,
  NLSearchModelCreateSchema,
} from 'typesense/lib/Typesense/NLSearchModels';
import type { ConversationModelCreateSchema } from 'typesense/lib/Typesense/ConversationModel';

export class Api {
  public axiosClient?: AxiosInstance;
  private typesenseClient?: Typesense.Client;

  public init({
    node,
    apiKey,
    connectionTimeoutSeconds,
  }: {
    node: NodeConfiguration;
    apiKey: string;
    connectionTimeoutSeconds?: number;
  }): void {
    this.axiosClient = axios.create({
      baseURL: `${node.protocol}://${node.host}:${node.port}${node.path || ''}`,
      headers: { 'x-typesense-api-key': apiKey },
    });
    const clientConfig: ConfigurationOptions = {
      nodes: [{ ...node }],
      apiKey,
    };
    if (connectionTimeoutSeconds !== undefined) {
      clientConfig.connectionTimeoutSeconds = connectionTimeoutSeconds;
    }
    this.typesenseClient = new Typesense.Client(clientConfig);
  }

  public getDebug() {
    return this.typesenseClient?.debug.retrieve();
  }

  public getCollections() {
    return this.typesenseClient?.collections().retrieve();
  }

  public createCollection(schema: CollectionCreateSchema) {
    return this.typesenseClient?.collections().create(schema);
  }

  public getCollection(collectionName: string) {
    return this.typesenseClient?.collections(collectionName).retrieve();
  }

  public dropCollection(collectionName: string) {
    return this.typesenseClient?.collections(collectionName).delete();
  }

  public updateCollection(collectionName: string, schema: CollectionUpdateSchema) {
    return this.typesenseClient?.collections(collectionName).update(schema);
  }

  public getAliases() {
    return this.typesenseClient?.aliases().retrieve();
  }

  public upsertAlias(alias: CollectionAliasSchema) {
    return this.typesenseClient
      ?.aliases()
      .upsert(alias.name, { collection_name: alias.collection_name });
  }

  public deleteAlias(name: string) {
    return this.typesenseClient?.aliases(name).delete();
  }

  public getApiKeys() {
    return this.typesenseClient?.keys().retrieve();
  }

  public createApiKey(apiKey: KeyCreateSchema) {
    return this.typesenseClient?.keys().create(apiKey);
  }

  public async deleteApiKey(id: string) {
    if (this.typesenseClient) {
      await this.typesenseClient.keys(parseInt(id, 10)).delete();
    }
  }

  public getAnalyticsRules() {
    return this.typesenseClient?.analytics.rules().retrieve();
  }

  public upsertAnalyticsRule(name: string, rule: AnalyticsRuleUpsertSchema) {
    return this.typesenseClient?.analytics.rules().upsert(name, rule);
  }

  /** Event counters kept by the server. Not in the API reference, so callers must tolerate failure. */
  public async getAnalyticsStatus(): Promise<Record<string, unknown> | undefined> {
    return (await this.axiosClient?.get('/analytics/status'))?.data;
  }

  public deleteAnalyticsRule(name: string) {
    return this.typesenseClient?.analytics.rules(name).delete();
  }

  public getSearchPresets() {
    return this.typesenseClient?.presets().retrieve();
  }

  public upsertSearchPreset(name: string, preset: PresetCreateSchema<any, any>) {
    return this.typesenseClient?.presets().upsert(name, preset);
  }

  public deleteSearchPreset(name: string) {
    return this.typesenseClient?.presets(name).delete();
  }

  public getStopwords() {
    return this.typesenseClient?.stopwords().retrieve();
  }

  public upsertStopwords(id: string, stopwordsSet: StopwordCreateSchema) {
    return this.typesenseClient?.stopwords().upsert(id, stopwordsSet);
  }

  public deleteStopwords(id: string) {
    return this.typesenseClient?.stopwords(id).delete();
  }

  public getStemmingDictionaries() {
    return this.typesenseClient?.stemming.dictionaries().retrieve();
  }

  public upsertStemmingDictionaries(id: string, wordRootCombinations: string | any[]) {
    return this.typesenseClient?.stemming.dictionaries().upsert(id, wordRootCombinations);
  }

  public getStemmingDictionary(id: string) {
    return this.typesenseClient?.stemming.dictionaries(id).retrieve();
  }

  public getSynonyms(collectionName: string) {
    return this.typesenseClient?.collections(collectionName).synonyms().retrieve();
  }

  public upsertSynonym(collectionName: string, id: string, synonym: SynonymSchema) {
    return this.typesenseClient?.collections(collectionName).synonyms().upsert(id, synonym);
  }

  public deleteSynonym(collectionName: string, id: string) {
    return this.typesenseClient?.collections(collectionName).synonyms(id).delete();
  }

  public getOverrides(collectionName: string) {
    return this.typesenseClient?.collections(collectionName).overrides().retrieve();
  }

  public upsertOverride(collectionName: string, id: string, override: OverrideCreateSchema) {
    return this.typesenseClient?.collections(collectionName).overrides().upsert(id, override);
  }

  public deleteOverride(collectionName: string, id: string) {
    return this.typesenseClient?.collections(collectionName).overrides(id).delete();
  }

  public deleteDocumentById(collectionName: string, id: string) {
    return this.typesenseClient?.collections(collectionName).documents(id).delete();
  }

  public importDocuments(collectionName: string, documents: unknown[] | string, action: string) {
    if (!this.typesenseClient) return;

    return (this.typesenseClient.collections(collectionName)?.documents() as any)
      .import(documents, { action })
      .catch((error: any) => {
        return error.importResults;
      });
  }

  /**
   * Imports JSONL and resolves with the server's JSONL result lines, one per document,
   * without throwing on per-document failures.
   */
  public importDocumentsJsonl(collectionName: string, jsonl: string, action: string) {
    return this.typesenseClient
      ?.collections(collectionName)
      .documents()
      .import(jsonl, { action: action as 'create' });
  }

  public exportDocuments(collectionName: string) {
    return this.typesenseClient?.collections(collectionName).documents().export();
  }

  public search(collectionName: string, searchParameters: SearchParams<any>) {
    return this.typesenseClient?.collections(collectionName).documents().search(searchParameters);
  }

  public get(url: string): Promise<any> | void {
    return this.axiosClient
      ?.get(url)
      .then((r) => {
        return { data: r.data };
      })
      .catch((err) => {
        throw Error(err.response?.data?.message || err.message);
      });
  }

  public post(url: string, body?: any): Promise<any> | void {
    return this.axiosClient
      ?.post(url, body)
      .then((r) => {
        return { data: r.data };
      })
      .catch((err) => {
        throw Error(err.response?.data?.message || err.message);
      });
  }

  public delete(url: string): Promise<any> | void {
    return this.axiosClient
      ?.delete(url)
      .then((r) => {
        return { data: r.data };
      })
      .catch((err) => {
        throw Error(err.response?.data?.message || err.message);
      });
  }

  // V30: Synonym Sets API
  public getSynonymSets() {
    return this.typesenseClient?.synonymSets().retrieve();
  }

  public getSynonymSet(name: string) {
    return this.typesenseClient?.synonymSets(name).retrieve();
  }

  public upsertSynonymSet(name: string, data: SynonymSetCreateSchema) {
    return this.typesenseClient?.synonymSets(name).upsert(data);
  }

  public upsertSynonymSetItem(
    setName: string,
    itemId: string,
    item: Omit<SynonymItemSchema, 'id'>,
  ) {
    return this.typesenseClient?.synonymSets(setName).items().upsert(itemId, item);
  }

  public deleteSynonymSetItem(setName: string, itemId: string) {
    return this.typesenseClient?.synonymSets(setName).items(itemId).delete();
  }

  public deleteSynonymSet(name: string) {
    return this.typesenseClient?.synonymSets(name).delete();
  }

  // V30: Curation Sets API
  public getCurationSets() {
    return this.typesenseClient?.curationSets().retrieve();
  }

  public getCurationSet(name: string) {
    return this.typesenseClient?.curationSets(name).retrieve();
  }

  public upsertCurationSet(name: string, data: CurationSetUpsertSchema) {
    return this.typesenseClient?.curationSets(name).upsert(data);
  }

  public upsertCurationSetItem(setName: string, item: CurationObjectSchema) {
    return this.typesenseClient?.curationSets(setName).items(item.id).upsert(item);
  }

  public deleteCurationSetItem(setName: string, itemId: string) {
    return this.typesenseClient?.curationSets(setName).items(itemId).delete();
  }

  public deleteCurationSet(name: string) {
    return this.typesenseClient?.curationSets(name).delete();
  }

  /** Deletes the documents matching a filter; resolves with `{ num_deleted }`. */
  public deleteDocumentsByFilter(collectionName: string, filterBy: string, batchSize?: number) {
    return this.typesenseClient
      ?.collections(collectionName)
      .documents()
      .delete({ filter_by: filterBy, ...(batchSize ? { batch_size: batchSize } : {}) });
  }

  /** Deletes every document but keeps the collection and its schema. */
  public truncateCollection(collectionName: string) {
    return this.typesenseClient?.collections(collectionName).documents().delete({ truncate: true });
  }

  // Natural-language search models (v29+)
  public getNlSearchModels() {
    return this.typesenseClient?.nlSearchModels().retrieve();
  }

  public createNlSearchModel(model: NLSearchModelCreateSchema) {
    return this.typesenseClient?.nlSearchModels().create(model);
  }

  public updateNlSearchModel(id: string, model: NLSearchModelBase) {
    return this.typesenseClient?.nlSearchModels(id).update(model);
  }

  public deleteNlSearchModel(id: string) {
    return this.typesenseClient?.nlSearchModels(id).delete();
  }

  // Conversation models for conversational search (RAG)
  public getConversationModels() {
    return this.typesenseClient?.conversations().models().retrieve();
  }

  public createConversationModel(model: ConversationModelCreateSchema) {
    return this.typesenseClient?.conversations().models().create(model);
  }

  public updateConversationModel(id: string, model: ConversationModelCreateSchema) {
    return this.typesenseClient?.conversations().models(id).update(model);
  }

  public deleteConversationModel(id: string) {
    return this.typesenseClient?.conversations().models(id).delete();
  }

  /**
   * Runs one search through `/multi_search`, which conversational search requires.
   * `commonParams` go in the query string (`conversation`, `conversation_model_id`, …).
   */
  public multiSearch(
    collectionName: string,
    searchParameters: Record<string, unknown>,
    commonParams: Record<string, unknown>,
  ) {
    return this.typesenseClient?.multiSearch.perform(
      { searches: [{ collection: collectionName, ...searchParameters }] },
      commonParams,
    );
  }

  public createSnapshot(snapshotPath: string) {
    return this.typesenseClient?.operations.perform('snapshot', { snapshot_path: snapshotPath });
  }
}
