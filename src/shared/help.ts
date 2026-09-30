/*
 * In-app help. Every page and many settings have a short, plain-language explanation
 * and links to the Typesense documentation: the API reference (what a setting is and
 * its exact parameters) and the Guide (how and when to use it).
 *
 * API reference links point at the docs for the connected server's version, since
 * parameters change between releases; the Guide is not versioned.
 */

export type DocKind = 'api' | 'guide';

export interface DocLink {
  kind: DocKind;
  /** Page name without extension, e.g. `collections`. */
  page: string;
  /** Section anchor on that page. */
  anchor?: string;
  /** Link text. Defaults to the page title for its kind. */
  label?: string;
}

export interface HelpTopic {
  title: string;
  /** What it is and what it does, in a sentence or three. */
  body: string;
  links: DocLink[];
}

/** The API reference version used when the server's version is unknown or not a release. */
export const FALLBACK_DOCS_VERSION = '30.2';

const DOCS_ROOT = 'https://typesense.org/docs';

/**
 * The docs version for a server version: `30.2` stays `30.2`, `0.25.2` stays `0.25.2`,
 * anything else (unknown, `nightly`, a commit hash) falls back to the version this
 * dashboard was built against.
 */
export function docsVersion(serverVersion: unknown): string {
  return typeof serverVersion === 'string' && /^\d+\.\d+(\.\d+)?$/.test(serverVersion)
    ? serverVersion
    : FALLBACK_DOCS_VERSION;
}

export function docUrl(link: DocLink, serverVersion?: unknown): string {
  const base =
    link.kind === 'api' ? `${DOCS_ROOT}/${docsVersion(serverVersion)}/api` : `${DOCS_ROOT}/guide`;
  return `${base}/${link.page}.html${link.anchor ? `#${link.anchor}` : ''}`;
}

export function apiReferenceUrl(serverVersion?: unknown): string {
  return `${DOCS_ROOT}/${docsVersion(serverVersion)}/api/`;
}

export const GUIDE_URL = `${DOCS_ROOT}/guide/`;

const api = (page: string, anchor?: string, label?: string): DocLink => ({
  kind: 'api',
  page,
  ...(anchor ? { anchor } : {}),
  ...(label ? { label } : {}),
});
const guide = (page: string, anchor?: string, label?: string): DocLink => ({
  kind: 'guide',
  page,
  ...(anchor ? { anchor } : {}),
  ...(label ? { label } : {}),
});

/** One entry per page, shown by the help button in the page header and on the Help page. */
export const PAGE_HELP = {
  status: {
    title: 'Server status',
    body: 'Live health, resource use and request rates for the server you are connected to. Memory or disk above the limits set at startup makes Typesense reject writes.',
    links: [
      api('cluster-operations', 'cluster-metrics', 'Metrics and stats endpoints'),
      api('cluster-operations', 'health', 'Health endpoint'),
      guide('running-in-production', 'monitoring', 'Monitoring in production'),
      guide('system-requirements', undefined, 'System requirements'),
    ],
  },
  settings: {
    title: 'Server settings',
    body: 'Settings you can change on the running server (lost on restart), one-off operations like snapshots and cache clearing, and a builder for settings that can only be set when the server starts, such as CORS.',
    links: [
      api('server-configuration', undefined, 'Server configuration reference'),
      api('cluster-operations', undefined, 'Cluster operations'),
      guide('backups', undefined, 'Backing up and restoring'),
      guide('running-in-production', 'configuration', 'Configuring for production'),
    ],
  },
  clusters: {
    title: 'Cluster',
    body: 'The nodes you tagged as one cluster in your server history. Each node reports whether it is the leader or a follower; writes go through the leader.',
    links: [
      guide('high-availability', undefined, 'High availability clusters'),
      api('cluster-operations', 're-elect-leader', 'Re-electing a leader'),
    ],
  },
  collections: {
    title: 'Collections',
    body: 'A collection is a set of documents with the same schema, like a table. Its schema says which fields are searchable, filterable, facetable and sortable.',
    links: [
      api('collections', undefined, 'Collections API'),
      guide('organizing-collections', undefined, 'Modelling and organizing collections'),
    ],
  },
  schema: {
    title: 'Schema',
    body: 'The fields of this collection and how each is indexed. Most changes are applied in place; a few settings can only be set when a collection is created, so the dashboard offers to recreate it for you.',
    links: [
      api('collections', 'field-parameters', 'Field parameters'),
      api('collections', 'field-types', 'Field types'),
      api('collections', 'update-or-alter-a-collection', 'Changing a schema'),
      guide('organizing-collections', undefined, 'Modelling collections'),
    ],
  },
  documents: {
    title: 'Add documents',
    body: 'Import documents as JSON or JSONL. Each document must match the schema; the import reports any that fail and why.',
    links: [
      api('documents', 'index-multiple-documents', 'Importing documents'),
      api('documents', 'action-modes-create-upsert-update-emplace', 'Import actions'),
      guide('syncing-data-into-typesense', undefined, 'Keeping Typesense in sync with your data'),
    ],
  },
  search: {
    title: 'Search',
    body: 'Try searches against this collection. Browse builds the query for you, Query as JSON sends any search parameters, and Ask uses an AI model to search in plain language.',
    links: [
      api('search', 'search-parameters', 'Search parameters'),
      guide('tips-for-filtering', undefined, 'filter_by syntax and examples'),
      guide('ranking-and-relevance', undefined, 'Ranking and relevance'),
    ],
  },
  aliases: {
    title: 'Aliases',
    body: 'An alias is a second name that points to a collection. Search the alias from your app, rebuild into a new collection, then move the alias with no downtime.',
    links: [
      api('collection-alias', undefined, 'Aliases API'),
      guide(
        'syncing-data-into-typesense',
        'zero-downtime-re-indexing-with-collection-aliases',
        'Zero-downtime reindexing with aliases',
      ),
    ],
  },
  synonyms: {
    title: 'Synonyms',
    body: 'Synonyms make a search for one word also find others. Since v30 they live in synonym sets that collections link to, so one set can serve many collections.',
    links: [
      api('synonyms', undefined, 'Synonym sets API'),
      api('synonyms', 'linking-synonym-sets-with-collections', 'Linking sets to collections'),
      api('synonyms', 'using-synonym-sets-in-search', 'Using synonym sets in a search'),
    ],
  },
  curations: {
    title: 'Curations',
    body: 'Curations (formerly overrides) change results for specific searches: pin documents to a position, hide others, or add filters and sorting when a query matches a rule.',
    links: [
      api('curation', undefined, 'Curation sets API'),
      api('curation', 'curation-item-parameters', 'Curation rule options'),
      guide(
        'ranking-and-relevance',
        'promoting-or-hiding-results-merchandising',
        'Promoting or hiding results',
      ),
    ],
  },
  presets: {
    title: 'Search presets',
    body: 'A preset is a saved set of search parameters. Searches pass preset=<name> and get those parameters; anything sent with the search overrides them.',
    links: [
      api('search', 'presets', 'Presets'),
      api('search', 'search-parameters', 'Search parameters'),
    ],
  },
  stopwords: {
    title: 'Stopwords',
    body: 'Stopwords are common words, like "the" or "and", that are removed from a query before searching. Searches choose a stopwords set with the stopwords parameter.',
    links: [
      api('stopwords', undefined, 'Stopwords API'),
      api('stopwords', 'using-stopwords-during-search', 'Using stopwords in a search'),
    ],
  },
  stemming: {
    title: 'Stemming',
    body: 'Stemming matches different forms of a word, such as run, runs and running. Dictionaries add your own word-to-root pairs on top of the built-in stemmer.',
    links: [
      api('stemming', undefined, 'Stemming API'),
      api('stemming', 'custom-stemming-dictionaries', 'Custom stemming dictionaries'),
      guide('locale', undefined, 'Languages and locales'),
    ],
  },
  searchAnalytics: {
    title: 'Search analytics',
    body: 'Charts of what people search for and click, read from the collections your analytics rules write to: popular searches, searches that found nothing, and the documents with the most clicks. Typesense keeps totals, not a history, so there is no chart over time.',
    links: [
      api('analytics-query-suggestions', undefined, 'Analytics API'),
      guide('search-analytics', undefined, 'Search analytics'),
    ],
  },
  analytics: {
    title: 'Analytics rules',
    body: 'Rules collect search and click events into collections: popular queries for suggestions, queries with no results, and counters that can boost popular documents.',
    links: [
      api('analytics-query-suggestions', undefined, 'Analytics API'),
      api(
        'analytics-query-suggestions',
        'analytics-rule-types-and-event-types',
        'Rule and event types',
      ),
      guide('search-analytics', undefined, 'Search analytics'),
      guide('query-suggestions', undefined, 'Query suggestions'),
    ],
  },
  apiKeys: {
    title: 'API keys',
    body: 'Keys control who can do what. Give apps the narrowest key that works: a search-only key in the browser, a write key on your server, and keep the admin key private.',
    links: [
      api('api-keys', undefined, 'API keys'),
      api('api-keys', 'generate-scoped-search-key', 'Scoped search keys'),
      guide('data-access-control', undefined, 'Access control'),
    ],
  },
  nlModels: {
    title: 'Natural-language search',
    body: 'An LLM turns a query like "red shoes under $50" into keywords, filters and sorting using your schema. Searches opt in with nl_query=true and nl_model_id.',
    links: [
      api('natural-language-search', undefined, 'Natural-language search API'),
      api('natural-language-search', 'supported-model-types', 'Supported models'),
      guide('natural-language-search', undefined, 'Natural-language search guide'),
    ],
  },
  conversationModels: {
    title: 'Conversation models',
    body: 'Conversational search (RAG) finds the documents that best match a question by meaning, then an LLM writes an answer from them. It needs an auto-embedding field and a history collection.',
    links: [
      api('conversational-search-rag', undefined, 'Conversational search API'),
      api('vector-search', 'creating-an-auto-embedding-field', 'Auto-embedding fields'),
      guide(
        'reference-implementations/pg-essays-conversational-search',
        undefined,
        'Example: conversational search',
      ),
    ],
  },
  login: {
    title: 'Connecting',
    body: 'The dashboard talks to your Typesense server from this browser, using an API key you provide. The server must allow this page with --enable-cors, or be on the same origin.',
    links: [
      api('authentication', undefined, 'Authentication'),
      api('server-configuration', 'cors', 'CORS settings'),
      guide('install-typesense', undefined, 'Installing Typesense'),
    ],
  },
} satisfies Record<string, HelpTopic>;

export type PageHelpKey = keyof typeof PAGE_HELP;

/** Help for individual settings, shown by the ⓘ next to a field. */
export const FIELD_HELP = {
  // Collection settings
  'collection.name': {
    title: 'Collection name',
    body: 'Cannot be changed after creation. To rename, create the new collection and point an alias at it.',
    links: [api('collections', 'schema-parameters')],
  },
  'collection.enable_nested_fields': {
    title: 'Nested fields',
    body: 'Allows object and object[] fields, and indexes their sub-fields as name.subfield. Can only be set when the collection is created.',
    links: [api('collections', 'indexing-nested-fields')],
  },
  'collection.default_sorting_field': {
    title: 'Default sorting field',
    body: 'A numeric field, such as a popularity score, used to order results when a search sets no sort_by and to break ties between equally good matches.',
    links: [api('collections', 'schema-parameters'), guide('ranking-and-relevance')],
  },
  'collection.token_separators': {
    title: 'Token separators',
    body: 'Characters that split words, in addition to spaces. Adding "-" indexes non-stick as non and stick.',
    links: [
      api('collections', 'schema-parameters'),
      guide(
        'tips-for-searching-common-types-of-data',
        undefined,
        'Searching SKUs, emails and URLs',
      ),
    ],
  },
  'collection.symbols_to_index': {
    title: 'Symbols to index',
    body: 'Characters that are normally dropped but should be kept, so a search for c++ or #hashtag matches exactly.',
    links: [
      api('collections', 'schema-parameters'),
      guide(
        'tips-for-searching-common-types-of-data',
        undefined,
        'Searching SKUs, emails and URLs',
      ),
    ],
  },
  'collection.metadata': {
    title: 'Metadata',
    body: 'Any JSON you want to keep with the collection, such as an owner or a version. Typesense stores it but does not use it.',
    links: [api('collections', 'adding-metadata-to-schema')],
  },
  'collection.synonym_sets': {
    title: 'Linked synonym sets',
    body: 'The synonym sets this collection uses on every search. A set must exist before it can be linked.',
    links: [api('synonyms', 'linking-synonym-sets-with-collections')],
  },
  'collection.curation_sets': {
    title: 'Linked curation sets',
    body: 'The curation sets whose rules apply to searches on this collection.',
    links: [api('curation', 'linking-curation-sets-with-collections')],
  },

  // Field settings
  'field.name': {
    title: 'Field name',
    body: 'The key in your documents. A name can be a pattern, like score_.* , to apply one definition to every matching key. Use a dot, like customer.name, for a sub-field of an object.',
    links: [api('collections', 'field-parameters'), api('collections', 'indexing-nested-fields')],
  },
  'field.type': {
    title: 'Field type',
    body: 'The kind of value the field holds. It decides which searches, filters and sorts are possible, and every document must match it.',
    links: [api('collections', 'field-types')],
  },
  'field.optional': {
    title: 'Optional',
    body: 'Documents may leave this field out or set it to null. Required fields reject documents that are missing them.',
    links: [api('collections', 'field-parameters')],
  },
  'field.index': {
    title: 'Index',
    body: 'Keeps the field in memory so it can be searched, filtered, faceted or sorted. Turn off for fields you only want returned in results; it saves memory.',
    links: [api('collections', 'field-parameters')],
  },
  'field.store': {
    title: 'Store',
    body: 'Keeps the value on disk so it is returned in results. Turn off for fields used only for searching, like an embedding you never display.',
    links: [api('collections', 'field-parameters')],
  },
  'field.facet': {
    title: 'Facet',
    body: 'Counts documents per value, for filters like "Brand: Nike (12)". Faceted fields also get exact-match filtering.',
    links: [api('search', 'facet-results'), api('collections', 'field-parameters')],
  },
  'field.sort': {
    title: 'Sort',
    body: 'Allows sort_by on this field. On by default for numbers; strings use extra memory when sortable.',
    links: [api('search', 'sort-results')],
  },
  'field.infix': {
    title: 'Infix search',
    body: 'Finds matches in the middle of words, like "phone" in "smartphone", when a search sets infix. Uses noticeably more memory.',
    links: [api('collections', 'field-parameters'), api('search', 'query-parameters')],
  },
  'field.stem': {
    title: 'Stemming',
    body: 'Indexes the root form of words so run, runs and running match each other.',
    links: [api('stemming', 'basic-stemming')],
  },
  'field.stem_dictionary': {
    title: 'Stemming dictionary',
    body: 'Your own word-to-root pairs, used instead of the built-in stemmer for this field.',
    links: [api('stemming', 'using-a-stemming-dictionary')],
  },
  'field.range_index': {
    title: 'Range index',
    body: 'Makes range filters such as price:>10 or price:[10..50] faster on large collections, at the cost of memory.',
    links: [
      api('collections', 'field-parameters'),
      guide('tips-for-filtering', 'the-range-operator'),
    ],
  },
  'field.locale': {
    title: 'Locale',
    body: 'The language used to split text into words. Needed for languages without spaces, such as Japanese, Chinese or Thai.',
    links: [guide('locale', undefined, 'Languages and locales')],
  },
  'field.truncate_len': {
    title: 'Truncate length',
    body: 'Only the first this-many characters of each word are indexed. The default of 100 suits almost everything.',
    links: [api('collections', 'field-parameters')],
  },
  'field.token_separators': {
    title: 'Token separators (field)',
    body: 'Extra characters that split words, for this field only. Overrides the collection setting.',
    links: [api('collections', 'field-parameters')],
  },
  'field.symbols_to_index': {
    title: 'Symbols to index (field)',
    body: 'Characters kept as part of words, for this field only. Overrides the collection setting.',
    links: [api('collections', 'field-parameters')],
  },
  'field.reference': {
    title: 'Reference',
    body: 'Links each document to a document in another collection (collection.field), so searches can join them, like SQL.',
    links: [api('joins', undefined, 'Joins')],
  },
  'field.async_reference': {
    title: 'Async reference',
    body: 'Lets documents be imported before the document they reference exists; the link is made when it arrives. The field must be optional.',
    links: [api('joins', 'asynchronous-references')],
  },
  'field.cascade_delete': {
    title: 'Cascade delete',
    body: 'Deletes this document when every document it references is deleted. Turning this off needs an async reference.',
    links: [api('joins', 'cascade-delete')],
  },
  'field.embed': {
    title: 'Auto-embedding',
    body: 'Typesense turns the listed fields into a vector with an embedding model, for semantic and hybrid search. Built-in ts/ models run on the server; others call a provider.',
    links: [
      api('vector-search', 'creating-an-auto-embedding-field'),
      api('vector-search', 'using-built-in-models', 'Built-in models'),
      guide('semantic-search', undefined, 'Semantic search guide'),
    ],
  },
  'field.num_dim': {
    title: 'Dimensions',
    body: 'The length of the vectors you import. Must match the model that produced them.',
    links: [api('vector-search', 'index-embeddings')],
  },
  'field.vec_dist': {
    title: 'Distance',
    body: 'How vector similarity is measured: cosine (the usual choice) or ip, inner product.',
    links: [api('vector-search', 'distance-metrics')],
  },
  'field.hnsw': {
    title: 'HNSW parameters',
    body: 'Tuning for the vector index. Higher values give more accurate nearest-neighbour results but use more memory and index slower.',
    links: [api('vector-search', 'configuring-hnsw-parameters')],
  },

  // Documents
  'documents.action': {
    title: 'When an ID already exists',
    body: 'Replace (upsert) overwrites the whole document, merge (emplace) creates or updates, update only changes existing documents, and skip (create) leaves them alone.',
    links: [api('documents', 'action-modes-create-upsert-update-emplace')],
  },
  'documents.filter_by': {
    title: 'Filter',
    body: 'Which documents to delete, in filter_by syntax: status:=closed, price:<10, tags:[a, b], combined with && and ||.',
    links: [
      api('documents', 'delete-by-query'),
      guide('tips-for-filtering', undefined, 'filter_by syntax and examples'),
    ],
  },
  'documents.truncate': {
    title: 'Delete all documents',
    body: 'Empties the collection in one request but keeps its schema, so you can reload data without recreating it.',
    links: [api('documents', 'delete-all-documents')],
  },

  // API keys
  'apiKey.actions': {
    title: 'Permissions',
    body: 'What the key may do, like documents:search or collections:*. Use the fewest permissions that work; a key with * can do everything.',
    links: [api('api-keys', 'sample-actions'), guide('data-access-control')],
  },
  'apiKey.collections': {
    title: 'Collections',
    body: 'The collections the key works on. Names can be patterns, like orders_.* ; * means all collections.',
    links: [api('api-keys', 'arguments')],
  },
  'apiKey.expires_at': {
    title: 'Expiry',
    body: 'After this date the key stops working. Short-lived keys limit the damage if one leaks.',
    links: [api('api-keys', 'arguments'), guide('data-access-control', 'key-rotation')],
  },

  // Synonyms and curations
  'synonym.kind': {
    title: 'Multi-way or one-way',
    body: 'Multi-way: every word finds the others (sneakers = trainers). One-way: searching the root also finds the synonyms, but not the other way round.',
    links: [api('synonyms', 'multi-way-synonym'), api('synonyms', 'one-way-synonym')],
  },
  'synonym.locale': {
    title: 'Locale',
    body: 'The language of the synonym, so it is split into words the same way as the text it matches.',
    links: [api('synonyms', 'arguments')],
  },
  'synonym.symbols_to_index': {
    title: 'Symbols to index',
    body: 'Characters kept as part of the synonym words, so c++ stays c++.',
    links: [api('synonyms', 'arguments')],
  },
  'curation.rule': {
    title: 'When',
    body: 'The rule that triggers the curation: a query (matched exactly or as contained words), a filter, or tags sent with the search.',
    links: [api('curation', 'curation-item-parameters')],
  },
  'curation.pin': {
    title: 'Pin',
    body: 'Documents placed at fixed positions in the results when the rule matches.',
    links: [api('curation', 'including-or-excluding-documents')],
  },
  'curation.hide': {
    title: 'Hide',
    body: 'Documents removed from the results when the rule matches.',
    links: [api('curation', 'including-or-excluding-documents')],
  },
  'curation.filter_by': {
    title: 'Filter results',
    body: 'A filter added to the search when the rule matches, e.g. category:=shoes for the query "shoes".',
    links: [api('curation', 'dynamic-filtering')],
  },
  'curation.sort_by': {
    title: 'Sort results',
    body: 'A sort order applied when the rule matches.',
    links: [api('curation', 'dynamic-sorting')],
  },
  'curation.tags': {
    title: 'Tags',
    body: 'Searches that send curation_tags only apply curations with matching tags; searches without tags only apply curations that have none. Useful for per-page or per-campaign rules.',
    links: [api('curation', 'add-tags-to-curation-items')],
  },

  'curation.replace_query': {
    title: 'Replace the search',
    body: 'Runs a different query instead of the one typed, when the rule matches. Useful for common misspellings or shorthand.',
    links: [api('curation', 'curation-item-parameters')],
  },
  'curation.effective': {
    title: 'Active dates',
    body: 'The curation only applies between these times, for example during a sale.',
    links: [api('curation', 'curation-item-parameters')],
  },
  'curation.remove_matched_tokens': {
    title: 'Remove the matched words',
    body: 'Drops the words that triggered the rule from the search, so a query like "shoes" filtered to category:=shoes does not also require the word. On by default.',
    links: [api('curation', 'curation-item-parameters')],
  },
  'curation.filter_curated_hits': {
    title: 'Filter pinned documents too',
    body: 'Applies the search’s own filters to pinned documents. Off by default, so pinned documents always show.',
    links: [api('curation', 'curation-item-parameters')],
  },
  'curation.stop_processing': {
    title: 'Stop at this curation',
    body: 'When on, no later curations run after this one matches. Curations run in order of their IDs. On by default.',
    links: [api('curation', 'curation-item-parameters')],
  },

  // Analytics rules
  'analytics.events': {
    title: 'Events',
    body: 'The event names your app sends, like a click or a conversion, and how much each adds to the counter.',
    links: [api('analytics-query-suggestions', 'counter-events')],
  },
  'analytics.source': {
    title: 'Collect from',
    body: 'The collections whose searches or events this rule records.',
    links: [api('analytics-query-suggestions', 'create-analytics-rules')],
  },
  'analytics.destination': {
    title: 'Write results to',
    body: 'The collection that holds the results: popular or no-result queries, or the documents whose counter field is updated.',
    links: [api('analytics-query-suggestions', 'create-a-collection-for-queries')],
  },
  'analytics.counter_field': {
    title: 'Counter field',
    body: 'A numeric field on the destination documents that each event increases, which you can then sort or boost by.',
    links: [api('analytics-query-suggestions', 'counter-events')],
  },
  'analytics.limit': {
    title: 'Keep the top',
    body: 'How many of the most frequent queries to keep.',
    links: [api('analytics-query-suggestions', 'popular-queries')],
  },
  'analytics.expand_query': {
    title: 'Store the full query',
    body: 'Records the word a prefix search matched ("shoe") instead of what was typed so far ("sho").',
    links: [api('analytics-query-suggestions', 'popular-queries')],
  },
  'analytics.capture_search_requests': {
    title: 'Count every search automatically',
    body: 'When off, only queries your app sends as events are counted, not every search request.',
    links: [api('analytics-query-suggestions', 'send-events-via-api')],
  },

  // Connecting
  'login.api_key': {
    title: 'API key',
    body: 'The admin key (--api-key at startup) shows every page. A scoped key only shows what it is allowed to do. The key is kept in this browser’s local storage.',
    links: [api('authentication'), guide('data-access-control')],
  },
  'login.path': {
    title: 'Path',
    body: 'Only needed when Typesense sits behind a proxy under a sub-path, like /typesense.',
    links: [api('authentication')],
  },
  'login.tls': {
    title: 'Verify the TLS certificate',
    body: 'Desktop app only. Turn off for servers with a self-signed certificate you trust.',
    links: [api('server-configuration', 'ssl-https')],
  },

  // Relevance extras
  'stopwords.locale': {
    title: 'Locale',
    body: 'The language of the stopwords, so they are split into words the same way as queries.',
    links: [api('stopwords', 'adding-stopwords')],
  },
  'preset.value': {
    title: 'Search parameters',
    body: 'Any search parameters, like query_by, sort_by or per_page. For multi-search presets, use a searches array.',
    links: [api('search', 'presets'), api('search', 'search-parameters')],
  },
  'analytics.type': {
    title: 'Rule type',
    body: 'popular_queries and nohits_queries collect search terms; counter counts click or conversion events per document; log keeps the raw events.',
    links: [api('analytics-query-suggestions', 'analytics-rule-types-and-event-types')],
  },

  // AI models
  'ai.provider': {
    title: 'Provider and model',
    body: "Where the LLM runs. The prefix picks the provider (openai/, google/, vllm/, …) and the rest is that provider's model name.",
    links: [
      api('natural-language-search', 'supported-model-types', 'Natural-language models'),
      api('conversational-search-rag', 'create-a-conversation-model', 'Conversation models'),
    ],
  },
  'nl.max_bytes': {
    title: 'Context size',
    body: 'The most bytes of your schema and example values sent to the model with each query. Larger schemas may need more, and larger requests cost more.',
    links: [api('natural-language-search', 'create-a-natural-language-search-model')],
  },
  'nl.system_prompt': {
    title: 'Extra instructions',
    body: 'Added to the prompt Typesense writes, e.g. "cheap means price under 20" or which fields hold dates.',
    links: [api('natural-language-search', 'create-a-natural-language-search-model')],
  },
  'conversation.history_collection': {
    title: 'History collection',
    body: 'Where Typesense stores each conversation, so follow-up questions have context. It needs a specific set of fields; the dashboard can create it for you.',
    links: [api('conversational-search-rag', 'create-a-conversation-history-collection')],
  },
  'conversation.system_prompt': {
    title: 'System prompt',
    body: 'Instructions for how the model should answer, e.g. to only use the documents provided and to say when it does not know.',
    links: [api('conversational-search-rag', 'parameters')],
  },
  'conversation.max_bytes': {
    title: 'Context size',
    body: 'The most bytes of search results and conversation history sent to the model per question.',
    links: [api('conversational-search-rag', 'parameters')],
  },
  'conversation.ttl': {
    title: 'Keep conversations for',
    body: 'Seconds before a stored conversation is deleted from the history collection.',
    links: [api('conversational-search-rag', 'parameters')],
  },
  'search.ask': {
    title: 'Ask',
    body: 'Find with filters uses a natural-language model to build the search. Get an answer uses a conversation model to answer from the best-matching documents.',
    links: [
      api('natural-language-search', 'perform-a-natural-language-search-query'),
      api('conversational-search-rag', 'start-a-conversation'),
    ],
  },
} satisfies Record<string, HelpTopic>;

export type FieldHelpKey = keyof typeof FIELD_HELP;

/** The server-configuration section documenting a startup or runtime flag. */
const FLAG_SECTIONS: Record<string, string> = {
  'enable-cors': 'cors',
  'cors-domains': 'cors',
  'enable-search-analytics': 'analytics',
  'analytics-dir': 'analytics',
  'analytics-flush-interval': 'analytics',
  'log-dir': 'logging',
  'enable-access-logging': 'logging',
  'enable-search-logging': 'logging',
  'log-slow-requests-time-ms': 'logging',
  'log-slow-searches-time-ms': 'logging',
  'api-address': 'networking',
  'api-port': 'networking',
  'ssl-certificate': 'ssl-https',
  'ssl-certificate-key': 'ssl-https',
  'max-per-page': 'search-limits',
  'filter-by-max-ops': 'search-limits',
  'max-group-limit': 'search-limits',
};

/** Link to the docs for a server flag, e.g. `cors-domains`. */
export function serverFlagLink(flag: string): DocLink {
  return api(
    'server-configuration',
    FLAG_SECTIONS[flag] ?? 'resource-usage',
    'Server configuration',
  );
}

/**
 * Help for a server setting, from the setting's own label and description.
 * Runtime settings also link to the endpoint that changes them on a running node.
 */
export function serverFlagTopic(
  flag: { key: string; label: string; description: string },
  runtime = false,
): HelpTopic {
  return {
    title: flag.label,
    body: flag.description.replace(/`/g, ''),
    links: [
      { ...serverFlagLink(flag.key), label: `--${flag.key}` },
      ...(runtime
        ? [api('cluster-operations', 'toggle-slow-request-log', 'Changing settings at runtime')]
        : []),
    ],
  };
}

/** Resolves a topic key, or passes a topic object through. */
export function resolveTopic(topic: string | HelpTopic): HelpTopic | undefined {
  if (typeof topic !== 'string') return topic;
  return (
    (PAGE_HELP as Record<string, HelpTopic>)[topic] ??
    (FIELD_HELP as Record<string, HelpTopic>)[topic]
  );
}

/**
 * Link text: the link's own label, else the section it points to ("Field parameters"),
 * else the page ("Tips for filtering"), so two links in one list never read the same.
 */
export function linkLabel(link: DocLink): string {
  if (link.label) return link.label;
  const slug = link.anchor ?? link.page.split('/').pop() ?? link.page;
  const words = slug.replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}
