<template>
  <article class="hit">
    <header class="hit__head">
      <span class="hit__rank text-mono" :aria-label="`Position ${hit.position}`">
        {{ hit.position }}
      </span>
      <div class="hit__heading">
        <h4 class="hit__title">
          <!-- eslint-disable-next-line vue/no-v-html -- escaped by safeHighlight, only <mark> survives -->
          <span v-if="titleSnippet" v-html="titleSnippet" />
          <template v-else>{{ titleText }}</template>
        </h4>
        <code class="hit__id">{{ hit.id }}</code>
      </div>
      <span v-if="change" class="hit__change" :class="`hit__change--${change.status}`">
        <template v-if="change.status === 'up'">▲ {{ change.delta }}</template>
        <template v-else-if="change.status === 'down'">▼ {{ -change.delta }}</template>
        <template v-else-if="change.status === 'new'">new</template>
        <template v-else>=</template>
        <q-tooltip v-if="change.before">Was #{{ change.before }} in the baseline</q-tooltip>
        <q-tooltip v-else>Not in the baseline results</q-tooltip>
      </span>
      <q-btn
        flat
        round
        dense
        size="sm"
        icon="sym_s_flag"
        aria-label="Add as test query"
        class="hit__action"
        @click="emit('expect', hit)"
      >
        <q-tooltip>Add a test: this document should rank high for this query</q-tooltip>
      </q-btn>
      <q-btn
        flat
        round
        dense
        size="sm"
        :icon="open ? 'sym_s_expand_less' : 'sym_s_expand_more'"
        :aria-label="open ? 'Hide details' : 'Show why it ranked here'"
        :aria-expanded="open"
        class="hit__action"
        @click="open = !open"
      >
        <q-tooltip>{{ open ? 'Hide details' : 'Why it ranked here' }}</q-tooltip>
      </q-btn>
    </header>

    <dl v-if="lines.length" class="hit__fields">
      <template v-for="line in lines" :key="line.field">
        <dt class="text-mono">{{ line.field }}</dt>
        <!-- eslint-disable-next-line vue/no-v-html -- escaped by safeHighlight, only <mark> survives -->
        <dd v-html="line.html" />
      </template>
    </dl>

    <div v-if="open" class="hit__why">
      <div class="ts-eyebrow q-mb-xs">Match details</div>
      <div v-if="facts.length" class="hit__facts">
        <span v-for="fact in facts" :key="fact.label" class="fact">
          <span class="fact__label">{{ fact.label }}</span>
          <strong class="text-mono">{{ fact.value }}</strong>
        </span>
      </div>
      <p v-else class="ts-faint text-caption q-ma-none">
        This response carries no match details (sorted by a field, or q is *).
      </p>
      <pre class="hit__json text-mono">{{ documentJson }}</pre>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { safeHighlight } from '@/shared/searchLab';
import type { LabHit, RankChange } from '@/shared/searchLab';

const props = defineProps<{
  hit: LabHit;
  /** Fields searched, in order; the first one with a value names the hit. */
  queryBy: string[];
  change?: RankChange | undefined;
}>();
const emit = defineEmits<{ expect: [hit: LabHit] }>();

const open = ref(false);

function text(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(text).join(', ');
  return typeof value === 'number' || typeof value === 'boolean'
    ? String(value)
    : JSON.stringify(value);
}

function escaped(value: string, max = 160): string {
  const clipped = value.length > max ? `${value.slice(0, max)}…` : value;
  return safeHighlight(clipped);
}

const titleField = computed(() =>
  props.queryBy.find((f) => props.hit.snippets[f] || text(props.hit.document[f]) !== ''),
);

const titleSnippet = computed(() => {
  const f = titleField.value;
  return f && props.hit.snippets[f] ? safeHighlight(props.hit.snippets[f]) : '';
});

const titleText = computed(() => {
  const f = titleField.value;
  return (f && text(props.hit.document[f])) || props.hit.id;
});

/** The other searched fields, with the matched words marked. */
const lines = computed(() =>
  props.queryBy
    .filter((f) => f !== titleField.value)
    .slice(0, 4)
    .map((field) => {
      const snippet = props.hit.snippets[field];
      const value = text(props.hit.document[field]);
      return {
        field,
        html: snippet ? safeHighlight(snippet) : escaped(value),
        empty: !snippet && !value,
      };
    })
    .filter((l) => !l.empty),
);

const facts = computed(() => {
  const info = props.hit.textMatchInfo ?? {};
  const out: { label: string; value: string }[] = [];
  const add = (label: string, value: unknown) => {
    if (typeof value === 'string' || typeof value === 'number')
      out.push({ label, value: String(value) });
  };
  if (props.hit.textMatch !== undefined) add('text match', props.hit.textMatch);
  add('words matched', info.tokens_matched);
  add('fields matched', info.fields_matched);
  add('words dropped', info.num_tokens_dropped);
  add('best field score', info.best_field_score);
  add('best field weight', info.best_field_weight);
  add('typo/prefix score', info.typo_prefix_score);
  if (props.hit.vectorDistance !== undefined) add('vector distance', props.hit.vectorDistance);
  return out;
});

const documentJson = computed(() => JSON.stringify(props.hit.document, null, 2));
</script>

<style scoped lang="scss">
.hit {
  padding: 10px 12px;
  border-top: 1px solid var(--ts-rule);
  &:first-child {
    border-top: 0;
  }
}

.hit__head {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.hit__rank {
  flex: none;
  min-width: 22px;
  padding: 1px 5px;
  border-radius: 5px;
  background: var(--ts-primary-soft);
  color: var(--ts-primary);
  font-size: 0.75rem;
  text-align: center;
}

.hit__heading {
  flex: 1;
  min-width: 0;
}

.hit__title {
  margin: 0;
  font-family: var(--ts-font-display);
  font-size: 0.95rem;
  font-weight: 600;
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.hit__id {
  font-size: 0.7rem;
  color: var(--ts-ink-3);
}

.hit__action {
  flex: none;
  color: var(--ts-ink-3);
}

.hit__change {
  flex: none;
  padding: 1px 6px;
  border-radius: 5px;
  font-size: 0.72rem;
  font-weight: 600;
  background: var(--ts-hover);
  color: var(--ts-ink-3);
}

.hit__change--up {
  background: var(--ts-primary-soft);
  color: var(--ts-primary);
}

.hit__change--down {
  background: var(--ts-warning-soft);
  color: var(--q-warning, #b7791f);
}

.hit__change--new {
  background: var(--ts-mark);
  color: var(--ts-mark-ink);
}

.hit__fields {
  display: grid;
  grid-template-columns: minmax(70px, max-content) minmax(0, 1fr);
  gap: 2px 10px;
  margin: 6px 0 0 30px;
  font-size: 0.8rem;
  dt {
    color: var(--ts-ink-3);
    font-size: 0.72rem;
    padding-top: 1px;
  }
  dd {
    margin: 0;
    color: var(--ts-ink-2);
    overflow-wrap: anywhere;
  }
}

.hit__why {
  margin: 10px 0 0 30px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--ts-sheet-2);
  border: 1px solid var(--ts-rule);
}

.hit__facts {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  font-size: 0.78rem;
}

.fact {
  display: inline-flex;
  gap: 6px;
  align-items: baseline;
}

.fact__label {
  color: var(--ts-ink-3);
}

.hit__json {
  max-height: 220px;
  margin: 10px 0 0;
  overflow: auto;
  font-size: 0.72rem;
  color: var(--ts-ink-2);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
