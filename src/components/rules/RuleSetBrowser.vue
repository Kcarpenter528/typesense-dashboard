<template>
  <div class="browser">
    <aside class="browser__sets ts-sheet" aria-label="Sets">
      <div class="browser__sets-head row items-center justify-between">
        <span class="ts-eyebrow">{{ setsLabel }}</span>
        <q-btn
          flat
          dense
          no-caps
          size="sm"
          icon="sym_s_add"
          :label="`New set`"
          @click="openCreate"
        />
      </div>
      <div v-if="ruleSets.loading.value && !ruleSets.sets.value.length" class="q-pa-md">
        <q-skeleton v-for="n in 3" :key="n" type="text" class="q-mb-sm" />
      </div>
      <button
        v-for="set in ruleSets.sets.value"
        :key="set.name"
        type="button"
        class="set"
        :class="{ 'is-selected': set.name === selected }"
        :aria-current="set.name === selected ? 'true' : undefined"
        @click="emit('update:selected', set.name)"
      >
        <span class="set__name text-mono">{{ set.name }}</span>
        <span class="set__meta">
          {{ set.items.length }} {{ set.items.length === 1 ? itemNoun : `${itemNoun}s` }}
          <template v-if="set.collections.length">
            · used by {{ set.collections.length }}
          </template>
          <template v-else> · not used</template>
        </span>
      </button>
      <div
        v-if="!ruleSets.loading.value && !ruleSets.sets.value.length"
        class="q-pa-md ts-faint text-caption"
      >
        No sets yet.
      </div>
    </aside>

    <section class="browser__detail">
      <template v-if="current">
        <div class="detail-head ts-sheet">
          <div class="row items-start no-wrap q-gutter-x-md">
            <div class="col">
              <h2 class="ts-section-title text-mono">{{ current.name }}</h2>
              <div class="usage">
                <template v-if="current.collections.length">
                  Used by
                  <router-link
                    v-for="c in current.collections"
                    :key="c"
                    :to="`/collection/${c}/search`"
                    class="usage__chip text-mono"
                  >
                    {{ c }}
                  </router-link>
                </template>
                <span v-else class="ts-faint">
                  Not used by any collection yet, so it doesn't affect searches.
                </span>
              </div>
            </div>
            <q-btn flat dense no-caps icon="sym_s_link" label="Collections" @click="openLinks">
              <q-tooltip>Choose which collections use this set</q-tooltip>
            </q-btn>
            <q-btn
              flat
              round
              dense
              icon="sym_s_delete"
              class="ts-danger-hover"
              :aria-label="`Delete ${ruleSets.noun}`"
              @click="confirmDelete"
            >
              <q-tooltip>Delete set</q-tooltip>
            </q-btn>
          </div>
        </div>
        <slot :set="current" />
      </template>
      <div v-else-if="!ruleSets.loading.value" class="ts-sheet">
        <empty-state :icon="emptyIcon" :title="emptyTitle" :body="emptyBody">
          <q-btn unelevated no-caps color="primary" label="New set" @click="openCreate" />
        </empty-state>
      </div>
    </section>

    <q-dialog v-model="createOpen">
      <q-card class="small-dialog">
        <q-form @submit="createSet">
          <q-card-section>
            <div class="ts-section-title q-mb-md">New {{ ruleSets.noun }}</div>
            <q-input
              v-model="newName"
              autofocus
              outlined
              label="Set name"
              :placeholder="kind === 'synonym' ? 'product-terms' : 'homepage-pins'"
              lazy-rules
              :rules="[
                (v) => !!v || 'Enter a name',
                (v) =>
                  !ruleSets.sets.value.some((s) => s.name === v) || 'A set with this name exists',
              ]"
            />
            <div class="ts-eyebrow q-mt-sm q-mb-xs">Use it in</div>
            <q-option-group
              v-model="newCollections"
              type="checkbox"
              :options="collectionOptions"
              class="collection-options"
            />
          </q-card-section>
          <q-card-actions align="right">
            <q-btn v-close-popup flat no-caps label="Cancel" />
            <q-btn unelevated no-caps color="primary" type="submit" label="Create set" />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>

    <q-dialog v-model="linksOpen">
      <q-card class="small-dialog">
        <q-card-section>
          <div class="ts-section-title">Collections using {{ current?.name }}</div>
          <p class="ts-muted q-mt-xs q-mb-md">
            Searches on the checked collections apply this set.
          </p>
          <q-option-group
            v-model="linkSelection"
            type="checkbox"
            :options="collectionOptions"
            class="collection-options"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn v-close-popup flat no-caps label="Cancel" />
          <q-btn
            unelevated
            no-caps
            color="primary"
            label="Save"
            :loading="saving"
            @click="saveLinks"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useNodeStore } from '@/stores/node';
import type { RuleSetKind, useRuleSets } from '@/shared/useRuleSets';
import EmptyState from '@/components/ui/EmptyState.vue';

const props = defineProps<{
  kind: RuleSetKind;
  ruleSets: ReturnType<typeof useRuleSets>;
  selected: string | null;
  itemNoun: string;
  emptyIcon: string;
  emptyTitle: string;
  emptyBody: string;
}>();

const emit = defineEmits<{ 'update:selected': [name: string | null] }>();

const $q = useQuasar();
const store = useNodeStore();

const setsLabel = computed(() => (props.kind === 'synonym' ? 'Synonym sets' : 'Curation sets'));
const current = computed(() => props.ruleSets.sets.value.find((s) => s.name === props.selected));

const collectionOptions = computed(() =>
  store.data.collections
    .map((c) => c.name)
    .sort()
    .map((name) => ({ label: name, value: name })),
);

// Keep a valid selection as sets load, get created or get deleted.
watch(
  () => props.ruleSets.sets.value.map((s) => s.name),
  (names) => {
    if (!props.selected || !names.includes(props.selected)) {
      emit('update:selected', names[0] ?? null);
    }
  },
  { immediate: true },
);

const createOpen = ref(false);
const newName = ref('');
const newCollections = ref<string[]>([]);

function openCreate() {
  newName.value = '';
  newCollections.value = [];
  createOpen.value = true;
}

async function createSet() {
  const name = newName.value.trim();
  if (!(await props.ruleSets.createSet(name))) return;
  if (newCollections.value.length) await props.ruleSets.setCollections(name, newCollections.value);
  createOpen.value = false;
  emit('update:selected', name);
  $q.notify({ type: 'positive', position: 'top', timeout: 1500, message: `Set ${name} created` });
}

const linksOpen = ref(false);
const linkSelection = ref<string[]>([]);
const saving = ref(false);

function openLinks() {
  linkSelection.value = [...(current.value?.collections ?? [])];
  linksOpen.value = true;
}

async function saveLinks() {
  if (!current.value) return;
  saving.value = true;
  const ok = await props.ruleSets.setCollections(current.value.name, linkSelection.value);
  saving.value = false;
  if (ok) {
    linksOpen.value = false;
    $q.notify({ type: 'positive', position: 'top', timeout: 1500, message: 'Collections updated' });
  }
}

function confirmDelete() {
  const set = current.value;
  if (!set) return;
  const usage = set.collections.length
    ? ` It's removed from ${set.collections.join(', ')} first, so their searches keep working.`
    : '';
  $q.dialog({
    title: `Delete ${props.ruleSets.noun} ${set.name}?`,
    message: `Its ${set.items.length} ${set.items.length === 1 ? props.itemNoun : `${props.itemNoun}s`} are deleted too.${usage}`,
    cancel: { flat: true, noCaps: true, label: 'Cancel' },
    ok: { unelevated: true, noCaps: true, color: 'negative', label: 'Delete set' },
  }).onOk(() => {
    void props.ruleSets.deleteSet(set.name).then((ok) => {
      if (ok) $q.notify({ position: 'top', timeout: 1500, message: `Set ${set.name} deleted` });
    });
  });
}
</script>

<style scoped lang="scss">
.browser {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
}

.browser__sets {
  padding: 6px;
  position: sticky;
  top: 72px;
}

.browser__sets-head {
  padding: 6px 6px 8px 10px;
}

.set {
  display: grid;
  gap: 2px;
  width: 100%;
  padding: 9px 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  text-align: left;
  font: inherit;
  color: var(--ts-ink);
  cursor: pointer;
  &:hover {
    background: var(--ts-hover);
  }
  &.is-selected {
    background: var(--ts-primary-soft);
    .set__name {
      font-weight: 500;
    }
  }
}

.set__name {
  font-size: 0.875rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.set__meta {
  font-size: 0.75rem;
  color: var(--ts-ink-3);
}

.browser__detail {
  display: grid;
  gap: 16px;
  min-width: 0;
}

.detail-head {
  padding: 16px 18px;
}

.usage {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  font-size: 0.85rem;
  color: var(--ts-ink-2);
}

.usage__chip {
  padding: 1px 8px;
  border-radius: 6px;
  border: 1px solid var(--ts-rule);
  color: var(--ts-ink);
  text-decoration: none;
  font-size: 0.8rem;
  &:hover {
    border-color: var(--ts-primary);
    color: var(--ts-primary);
  }
}

.small-dialog {
  width: min(460px, 94vw);
}

.collection-options {
  max-height: 260px;
  overflow-y: auto;
  :deep(.q-checkbox__label) {
    font-family: var(--ts-font-mono);
    font-size: 0.85rem;
  }
}
</style>
