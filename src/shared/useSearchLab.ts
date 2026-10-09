import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { LocalStorage } from 'quasar';
import { useNodeStore } from '@/stores/node';
import { useCollectionsStore } from '@/stores/collections';
import {
  buildRequest,
  createSearch,
  createTest,
  defaultConfig,
  diffHits,
  duplicateSearch,
  evaluateTest,
  parseResponse,
  requestForTest,
  summarizeDiff,
  switchCollection,
  validateConfig,
} from './searchLab';
import type {
  LabConfig,
  LabRequest,
  LabResult,
  LabSearch,
  LabTest,
  TestOutcome,
} from './searchLab';

interface Saved {
  config: LabConfig;
  tests: LabTest[];
  autoRun: boolean;
}

interface Baseline {
  config: LabConfig;
  results: Record<string, LabResult>;
  takenAt: number;
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Drops anything stored by an older version or hand-edited into an unusable shape. */
function sanitize(saved: unknown): Saved | null {
  if (!saved || typeof saved !== 'object') return null;
  const s = saved as Partial<Saved>;
  const config = s.config;
  if (!config || typeof config.q !== 'string' || !Array.isArray(config.searches)) return null;
  return {
    config: {
      q: config.q,
      common: config.common && typeof config.common === 'object' ? config.common : {},
      searches: config.searches.filter(
        (x) =>
          x &&
          typeof x.id === 'string' &&
          typeof x.collection === 'string' &&
          Array.isArray(x.queryBy),
      ),
    },
    tests: Array.isArray(s.tests) ? s.tests.filter((t) => t && typeof t.id === 'string') : [],
    autoRun: s.autoRun !== false,
  };
}

/**
 * State and actions for the search lab: the request being tuned, its latest results, a
 * pinned baseline to compare against, and a saved set of test queries. Settings are kept
 * in this browser, per server.
 */
export function useSearchLab() {
  const node = useNodeStore();
  const collectionsStore = useCollectionsStore();

  const storageKey = computed(() => {
    const n = node.loginData?.node;
    return `typesense-search-lab-${n ? `${n.host}:${n.port}` : 'default'}`;
  });

  let saved: Saved | null;
  try {
    saved = sanitize(LocalStorage.getItem(storageKey.value));
  } catch {
    saved = null;
  }

  const config = reactive<LabConfig>(saved?.config ?? defaultConfig());
  const tests = ref<LabTest[]>(saved?.tests ?? []);
  const autoRun = ref(saved?.autoRun ?? true);

  const results = ref<Record<string, LabResult>>({});
  const running = ref(false);
  const runError = ref<string | null>(null);
  const roundTripMs = ref<number | null>(null);
  const baseline = ref<Baseline | null>(null);

  const outcomes = ref<Record<string, TestOutcome>>({});
  const testsRunning = ref(false);

  const request = computed<LabRequest>(() => buildRequest(config));
  const problems = computed(() => validateConfig(config));

  const collectionNames = computed(() => collectionsStore.collections.map((c) => c.name));

  function fieldsOf(collection: string) {
    return collectionsStore.collections.find((c) => c.name === collection)?.fields;
  }

  // ---- Running ---------------------------------------------------------------------------

  let runId = 0;

  async function run() {
    if (problems.value.length || !node.api) return;
    const id = ++runId;
    const req = request.value;
    const sent = clone(config.searches);
    running.value = true;
    runError.value = null;
    const started = performance.now();
    try {
      const response = await node.api.multiSearchMany(req.searches, req.commonParams);
      if (id !== runId) return; // a newer run superseded this one
      const parsed = parseResponse(response, req.searches);
      results.value = Object.fromEntries(sent.map((s, i) => [s.id, parsed[i] as LabResult]));
      roundTripMs.value = Math.round(performance.now() - started);
    } catch (error) {
      if (id !== runId) return;
      runError.value = (error as Error).message;
    } finally {
      if (id === runId) running.value = false;
    }
  }

  let timer: number | undefined;
  watch(
    () => JSON.stringify(request.value),
    () => {
      if (!autoRun.value) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void run(), 400);
    },
  );
  onBeforeUnmount(() => window.clearTimeout(timer));

  // ---- Searches --------------------------------------------------------------------------

  function addSearch(collection: string) {
    config.searches.push(createSearch(collection, fieldsOf(collection)));
  }

  function updateSearch(index: number, search: LabSearch) {
    config.searches.splice(index, 1, search);
  }

  function changeCollection(index: number, collection: string) {
    const current = config.searches[index];
    if (current)
      config.searches.splice(index, 1, switchCollection(current, collection, fieldsOf(collection)));
  }

  function removeSearch(index: number) {
    const [removed] = config.searches.splice(index, 1);
    if (removed) delete results.value[removed.id];
  }

  function copySearch(index: number) {
    const original = config.searches[index];
    if (original) config.searches.splice(index + 1, 0, duplicateSearch(original));
  }

  function replaceSearches(searches: LabSearch[]) {
    config.searches.splice(0, config.searches.length, ...searches);
    results.value = {};
  }

  // ---- Baseline --------------------------------------------------------------------------

  function pinBaseline() {
    baseline.value = { config: clone(config), results: clone(results.value), takenAt: Date.now() };
  }

  function clearBaseline() {
    baseline.value = null;
  }

  /** Puts the settings back as they were when the baseline was pinned. */
  function restoreBaseline() {
    if (!baseline.value) return;
    const b = clone(baseline.value.config);
    config.q = b.q;
    config.common = b.common;
    replaceSearches(b.searches);
    results.value = clone(baseline.value.results);
  }

  /** How the whole run moved against the baseline, summed over the collections both have. */
  const baselineSummary = computed(() => {
    const b = baseline.value;
    if (!b) return null;
    const total = { up: 0, down: 0, added: 0, removed: 0, compared: 0 };
    for (const [id, now] of Object.entries(results.value)) {
      const before = b.results[id];
      if (!before) continue;
      const s = summarizeDiff(diffHits(now.hits, before.hits));
      total.up += s.up;
      total.down += s.down;
      total.added += s.added;
      total.removed += s.removed;
      total.compared += 1;
    }
    return total;
  });

  // ---- Tests -----------------------------------------------------------------------------

  function addTest(partial: Partial<LabTest> = {}) {
    tests.value.push(createTest({ q: config.q, ...partial }));
  }

  function removeTest(id: string) {
    tests.value = tests.value.filter((t) => t.id !== id);
    delete outcomes.value[id];
  }

  async function runTests() {
    if (!node.api || testsRunning.value) return;
    testsRunning.value = true;
    outcomes.value = {};
    try {
      for (const test of tests.value) {
        const req = requestForTest(config, test);
        if (!req) {
          outcomes.value[test.id] = {
            pass: false,
            found: [],
            error: `${test.collection} is not in the lab.`,
          };
          continue;
        }
        try {
          const response = await node.api.multiSearchMany(req.searches, req.commonParams);
          outcomes.value[test.id] = evaluateTest(test, parseResponse(response, req.searches));
        } catch (error) {
          outcomes.value[test.id] = { pass: false, found: [], error: (error as Error).message };
        }
      }
    } finally {
      testsRunning.value = false;
    }
  }

  const testSummary = computed(() => {
    const done = tests.value.filter((t) => outcomes.value[t.id]);
    return { done: done.length, passed: done.filter((t) => outcomes.value[t.id]?.pass).length };
  });

  // ---- Saving ----------------------------------------------------------------------------

  watch(
    [() => clone(config), tests, autoRun],
    () => {
      try {
        LocalStorage.set(storageKey.value, {
          config: clone(config),
          tests: clone(tests.value),
          autoRun: autoRun.value,
        } satisfies Saved);
      } catch {
        // Storage can be full or blocked; the lab still works without it.
      }
    },
    { deep: true },
  );

  return {
    config,
    tests,
    autoRun,
    results,
    running,
    runError,
    roundTripMs,
    baseline,
    baselineSummary,
    outcomes,
    testsRunning,
    testSummary,
    request,
    problems,
    collectionNames,
    fieldsOf,
    run,
    addSearch,
    updateSearch,
    changeCollection,
    removeSearch,
    copySearch,
    replaceSearches,
    pinBaseline,
    clearBaseline,
    restoreBaseline,
    addTest,
    removeTest,
    runTests,
  };
}
