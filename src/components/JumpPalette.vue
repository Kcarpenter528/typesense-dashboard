<template>
  <q-dialog
    :model-value="modelValue"
    position="top"
    transition-show="fade"
    transition-hide="fade"
    @update:model-value="emit('update:modelValue', $event)"
    @show="onShow"
  >
    <div class="palette" role="dialog" aria-label="Jump to">
      <div class="palette__search row no-wrap items-center">
        <q-icon name="sym_s_search" size="20px" class="palette__search-icon" />
        <input
          ref="input"
          v-model="query"
          class="palette__input"
          placeholder="milestone schema"
          aria-label="Page or collection to jump to"
          role="combobox"
          aria-expanded="true"
          aria-controls="jump-results"
          :aria-activedescendant="results.length ? `jump-${active}` : undefined"
          autocomplete="off"
          spellcheck="false"
          @keydown.down.prevent="move(1)"
          @keydown.up.prevent="move(-1)"
          @keydown.enter.prevent="go(results[active])"
        />
        <kbd>Esc</kbd>
      </div>

      <div id="jump-results" class="palette__results" role="listbox">
        <template v-for="(result, index) in results" :key="result.to">
          <div
            v-if="index === 0 || results[index - 1]!.group !== result.group"
            class="palette__group"
          >
            {{ result.group }}
          </div>
          <div
            :id="`jump-${index}`"
            role="option"
            :aria-selected="index === active"
            class="palette__item row no-wrap items-center"
            :class="{ 'is-active': index === active }"
            @mousemove="active = index"
            @click="go(result)"
          >
            <q-icon :name="result.icon" size="18px" class="palette__item-icon" />
            <span class="palette__item-label" :class="{ 'text-mono': result.mono }">
              <template v-for="(part, i) in result.parts" :key="i">
                <mark v-if="part.hit">{{ part.text }}</mark>
                <template v-else>{{ part.text }}</template>
              </template>
            </span>
            <span v-if="result.hint" class="palette__item-hint">{{ result.hint }}</span>
          </div>
        </template>
        <div v-if="!results.length" class="palette__empty">
          No page or collection matches “{{ query }}”.
        </div>
      </div>
    </div>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useNodeStore } from '@/stores/node';
import { collectionTabs, fuzzyMatch, NAV_SECTIONS } from '@/shared/navigation';

interface Entry {
  label: string;
  /** Text matched against the query (label plus keywords). */
  haystack: string;
  to: string;
  icon: string;
  group: string;
  hint?: string;
  mono?: boolean;
}

interface Result extends Entry {
  parts: { text: string; hit: boolean }[];
  score: number;
}

defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();

const store = useNodeStore();
const router = useRouter();
const input = ref<HTMLInputElement | null>(null);
const query = ref('');
const active = ref(0);

const entries = computed<Entry[]>(() => {
  const pages: Entry[] = NAV_SECTIONS.flatMap((section) =>
    section.items
      .filter((item) => !item.available || item.available(store))
      .map((item) => ({
        label: item.label,
        haystack: `${item.label} ${item.keywords ?? ''}`,
        to: item.to,
        icon: item.icon,
        group: 'Pages',
        hint: section.label,
      })),
  );
  const collections = store.data.collections
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((c) => {
      const open: Entry = {
        label: c.name,
        haystack: c.name,
        to: `/collection/${encodeURIComponent(c.name)}/search`,
        icon: 'sym_s_folder_data',
        group: 'Collections',
        hint: `${(c.num_documents ?? 0).toLocaleString()} documents`,
        mono: true,
      };
      // Individual tabs only come up once you type, to keep the default list short.
      const tabs: Entry[] = query.value.trim()
        ? collectionTabs(store, c.name).map((tab) => ({
            label: `${c.name} › ${tab.label}`,
            haystack: `${c.name} ${tab.label}`,
            to: tab.to,
            icon: tab.icon,
            group: 'Collections',
            mono: true,
          }))
        : [];
      return [open, ...tabs];
    });
  return [...pages, ...collections];
});

function highlight(label: string, positions: number[]) {
  const hits = new Set(positions);
  const parts: Result['parts'] = [];
  for (let i = 0; i < label.length; i++) {
    const hit = hits.has(i);
    const last = parts[parts.length - 1];
    if (last && last.hit === hit) last.text += label[i];
    else parts.push({ text: label[i]!, hit });
  }
  return parts;
}

const results = computed<Result[]>(() => {
  const q = query.value.trim();
  const matched: Result[] = [];
  for (const entry of entries.value) {
    const onHaystack = fuzzyMatch(entry.haystack, q);
    if (!onHaystack) continue;
    // Highlight on the visible label; keyword-only matches show no highlight.
    const onLabel = fuzzyMatch(entry.label.replace(' › ', ' '), q) ?? [];
    const labelPositions = entry.label.includes(' › ')
      ? onLabel.map((p) => (p >= entry.label.indexOf(' › ') ? p + 2 : p))
      : onLabel;
    const spread = onHaystack.length ? onHaystack[onHaystack.length - 1]! - onHaystack[0]! : 0;
    matched.push({
      ...entry,
      parts: highlight(entry.label, labelPositions),
      score: (onHaystack[0] ?? 0) + spread * 0.5 + (entry.group === 'Pages' ? 0 : 0.1),
    });
  }
  if (!q) return matched;
  return matched.sort((a, b) => a.score - b.score).slice(0, 30);
});

watch(query, () => (active.value = 0));

function move(step: number) {
  if (!results.value.length) return;
  active.value = (active.value + step + results.value.length) % results.value.length;
  void nextTick(() =>
    document.getElementById(`jump-${active.value}`)?.scrollIntoView({ block: 'nearest' }),
  );
}

function go(result: Result | undefined) {
  if (!result) return;
  emit('update:modelValue', false);
  void router.push(result.to);
}

function onShow() {
  query.value = '';
  active.value = 0;
  input.value?.focus();
}
</script>

<style scoped lang="scss">
.palette {
  width: min(600px, 94vw);
  margin-top: 12vh;
  background: var(--ts-sheet);
  color: var(--ts-ink);
  border: 1px solid var(--ts-rule);
  border-radius: 14px;
  box-shadow: var(--ts-shadow);
  overflow: hidden;
}

.palette__search {
  gap: 10px;
  padding: 0 14px;
  height: 54px;
  border-bottom: 1px solid var(--ts-rule);
}

.palette__search-icon {
  color: var(--ts-ink-3);
}

.palette__input {
  flex: 1;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--ts-ink);
  font: inherit;
  font-size: 1rem;
  &::placeholder {
    color: var(--ts-ink-3);
  }
}

kbd {
  font-family: var(--ts-font-mono);
  font-size: 0.7rem;
  padding: 2px 6px;
  border: 1px solid var(--ts-rule);
  border-radius: 5px;
  color: var(--ts-ink-3);
}

.palette__results {
  max-height: min(420px, 60vh);
  overflow-y: auto;
  padding: 6px;
}

.palette__group {
  padding: 10px 10px 4px;
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--ts-ink-3);
}

.palette__item {
  gap: 12px;
  height: 38px;
  padding: 0 10px;
  border-radius: 8px;
  cursor: pointer;
  &.is-active {
    background: var(--ts-primary-soft);
  }
}

.palette__item-icon {
  color: var(--ts-ink-3);
}

.palette__item-label {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.9rem;
}

.palette__item-hint {
  font-size: 0.75rem;
  color: var(--ts-ink-3);
}

.palette__empty {
  padding: 24px 12px;
  text-align: center;
  color: var(--ts-ink-3);
  font-size: 0.9rem;
}
</style>
