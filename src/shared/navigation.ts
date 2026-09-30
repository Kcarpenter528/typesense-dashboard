import type { useNodeStore } from '@/stores/node';
import type { PageHelpKey } from './help';

type Store = ReturnType<typeof useNodeStore>;

export interface NavItem {
  label: string;
  to: string;
  icon: string;
  /** The page's help topic, listed on the Help page. */
  help?: PageHelpKey;
  /** Extra words the jump palette matches on. */
  keywords?: string;
  /** Hidden when this returns false (feature not supported or not permitted by the key). */
  available?: (store: Store) => boolean;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

/**
 * The app's destinations, grouped by what they manage. Used by the sidebar and the
 * jump palette so both always list the same pages under the same names.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Server',
    items: [
      {
        label: 'Status',
        to: '/',
        help: 'status',
        icon: 'sym_s_monitor_heart',
        keywords: 'health metrics cpu memory',
      },
      {
        label: 'Settings',
        to: '/settings',
        help: 'settings',
        icon: 'sym_s_tune',
        keywords: 'cors config cache snapshot compact operations docker',
      },
      {
        label: 'Cluster',
        to: '/clusters',
        help: 'clusters',
        icon: 'sym_s_hub',
        keywords: 'nodes leader follower',
        available: (s) => !!s.currentClusterTag,
      },
    ],
  },
  {
    label: 'Data',
    items: [
      {
        label: 'Collections',
        to: '/collections',
        help: 'collections',
        icon: 'sym_s_folder_data',
        keywords: 'schema index',
      },
      {
        label: 'Aliases',
        to: '/aliases',
        help: 'aliases',
        icon: 'sym_s_alt_route',
        available: (s) => s.data.features.aliases,
      },
    ],
  },
  {
    label: 'Relevance',
    items: [
      {
        label: 'Synonyms',
        to: '/synonyms',
        help: 'synonyms',
        icon: 'sym_s_join',
        keywords: 'synonym sets',
        available: (s) => s.data.features.synonymSets,
      },
      {
        label: 'Curations',
        to: '/curations',
        help: 'curations',
        icon: 'sym_s_push_pin',
        keywords: 'overrides pin hide curation sets',
        available: (s) => s.data.features.curationSets,
      },
      {
        label: 'Search presets',
        to: '/searchpresets',
        help: 'presets',
        icon: 'sym_s_bookmark',
        available: (s) => s.data.features.searchPresets,
      },
      {
        label: 'Stopwords',
        to: '/stopwords',
        help: 'stopwords',
        icon: 'sym_s_format_strikethrough',
        available: (s) => s.data.features.stopwords,
      },
      {
        label: 'Stemming',
        to: '/stemming',
        help: 'stemming',
        icon: 'sym_s_spellcheck',
        keywords: 'dictionaries',
        available: (s) => s.data.features.stemmingDictionaries,
      },
      {
        label: 'Analytics rules',
        to: '/analyticsrules',
        help: 'analytics',
        icon: 'sym_s_insights',
        keywords: 'popular queries no hits counters',
        available: (s) => s.data.features.analyticsRules,
      },
    ],
  },
  {
    label: 'AI search',
    items: [
      {
        label: 'Natural language',
        to: '/nl-models',
        help: 'nlModels',
        icon: 'sym_s_translate',
        keywords: 'nl search models llm openai gemini vllm',
        available: (s) => s.data.features.nlSearchModels,
      },
      {
        label: 'Conversations',
        to: '/conversation-models',
        help: 'conversationModels',
        icon: 'sym_s_forum',
        keywords: 'rag chat conversational search models llm answers',
        available: (s) => s.data.features.conversationModels,
      },
    ],
  },
  {
    label: 'Access',
    items: [
      {
        label: 'API keys',
        to: '/apikeys',
        help: 'apiKeys',
        icon: 'sym_s_key',
        keywords: 'keys permissions scoped',
        available: (s) => s.data.features.apiKeys,
      },
    ],
  },
  {
    label: 'Help',
    items: [
      {
        label: 'Help & docs',
        to: '/help',
        icon: 'sym_s_help',
        keywords: 'documentation guide faq getting started how to',
      },
    ],
  },
];

/** Tabs shown under a collection's header. */
export function collectionTabs(store: Store, name: string) {
  const base = `/collection/${encodeURIComponent(name)}`;
  const tabs = [
    { label: 'Search', to: `${base}/search`, icon: 'sym_s_search' },
    { label: 'Schema', to: `${base}/schema`, icon: 'sym_s_data_object' },
    { label: 'Add documents', to: `${base}/document`, icon: 'sym_s_note_add' },
  ];
  // Before v30, synonyms and curations belong to a collection.
  if (!store.data.features.synonymSets) {
    tabs.push({ label: 'Synonyms', to: `${base}/synonyms`, icon: 'sym_s_join' });
  }
  if (!store.data.features.curationSets) {
    tabs.push({ label: 'Curations', to: `${base}/curations`, icon: 'sym_s_push_pin' });
  }
  return tabs;
}

/**
 * Fuzzy subsequence match used by the jump palette. Returns the matched character
 * positions (for highlighting) or null when the query does not match.
 */
export function fuzzyMatch(text: string, query: string): number[] | null {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const t = text.toLowerCase();
  // Prefer a contiguous match so "sche" highlights "Sche" in "Schema".
  const start = t.indexOf(q);
  if (start >= 0) return Array.from({ length: q.length }, (_, i) => start + i);
  const positions: number[] = [];
  let from = 0;
  for (const char of q) {
    if (char === ' ') continue;
    const index = t.indexOf(char, from);
    if (index < 0) return null;
    positions.push(index);
    from = index + 1;
  }
  return positions;
}
