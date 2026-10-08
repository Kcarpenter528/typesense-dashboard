<template>
  <dl class="fields" :class="{ 'fields--nested': nested }">
    <div
      v-for="key in visibleKeys"
      :key="key"
      class="field"
      :class="{
        'is-unknown': !isKnown(key),
        'is-joined': joinedKeys.includes(key),
      }"
    >
      <dt class="field__name">
        {{ key }}
        <span v-if="Array.isArray(item[key]) && item[key].length > 1" class="field__count">
          ×{{ item[key].length }}
        </span>
        <span v-if="joinedKeys.includes(key)" class="field__tag">joined</span>
      </dt>
      <dd
        v-if="!embedFields.includes(key)"
        class="field__value"
        :title="JSON.stringify(extractValue(item[key]), null, 2)"
      >
        <div
          v-if="Array.isArray(item[key])"
          :class="isArrayField(item[key]) ? 'array-field' : 'nested-field'"
        >
          <template v-for="(subitem, index) in item[key]" :key="index">
            <div v-if="isHighlightLeaf(subitem)">
              <search-result-item-attribute :hit="subitem" />
            </div>
            <search-result-item-nested-display
              v-else
              nested
              :item="subitem"
              :include-fields="nestedFieldsFor(includeFields, key)"
              :embed-fields="nestedFieldsFor(embedFields, key)"
            />
          </template>
        </div>
        <template v-else>
          <search-result-item-attribute v-if="isHighlightLeaf(item[key])" :hit="item[key]" />
          <search-result-item-nested-display
            v-else-if="isPlainObject(item[key])"
            nested
            :item="item[key]"
            :include-fields="nestedFieldsFor(includeFields, key)"
            :embed-fields="nestedFieldsFor(embedFields, key)"
          />
          <span v-else>{{ String(item[key]) }}</span>
        </template>
      </dd>
      <dd v-else class="field__value ts-faint">Embedding, not shown</dd>
    </div>
  </dl>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import SearchResultItemAttribute from './SearchResultItemAttribute.vue';
const props = withDefaults(
  defineProps<{
    item: Record<string, any>;
    includeFields?: string[];
    embedFields?: string[];
    /** Keys that hold documents joined in through a reference field. */
    joinedKeys?: string[];
    /** Keys to leave out, such as the ones the card header already shows. */
    omit?: string[];
    /** Show only this many fields; 0 shows all. */
    limit?: number;
    nested?: boolean;
  }>(),
  {
    includeFields: () => [],
    embedFields: () => [],
    joinedKeys: () => [],
    omit: () => [],
    limit: 0,
    nested: false,
  },
);

function isHighlightLeaf(item: any): item is { value: unknown; matchLevel: unknown } {
  if (item === null || item === undefined || typeof item !== 'object') return false;
  return (
    Object.prototype.hasOwnProperty.call(item, 'value') &&
    Object.prototype.hasOwnProperty.call(item, 'matchLevel')
  );
}

function isPlainObject(item: any): item is Record<string, any> {
  return item !== null && item !== undefined && typeof item === 'object' && !Array.isArray(item);
}

function isArrayField(obj: any[]) {
  return obj.some((subitem: any) => isHighlightLeaf(subitem));
}

function isKnown(key: string) {
  // A joined document has no schema here, so its fields aren't flagged as unknown.
  if (props.nested && props.includeFields.length === 0) return true;
  return (
    props.joinedKeys.includes(key) ||
    props.includeFields.includes(key) ||
    props.includeFields.some((field) => field.startsWith(`${key}.`))
  );
}

function nestedFieldsFor(fields: string[], key: string) {
  return fields
    .filter((field) => {
      return field.startsWith(key) && field !== key;
    })
    .map((field) => field.replace(`${key}.`, ''));
}

const sortedKeys = computed(() => {
  const keys = Object.keys(props.item).filter((key) => !props.omit.includes(key));
  return props.includeFields
    .filter((key) => keys.includes(key))
    .concat(keys.filter((key) => !props.includeFields.includes(key)));
});

// Joined documents always show: they are the reason to open the record.
const visibleKeys = computed(() => {
  if (props.limit <= 0) return sortedKeys.value;
  const joined = sortedKeys.value.filter((key) => props.joinedKeys.includes(key));
  const plain = sortedKeys.value.filter((key) => !props.joinedKeys.includes(key));
  return [...plain.slice(0, props.limit), ...joined];
});

function extractValue(item: any): any {
  // Handle primitive values
  if (item === null || item === undefined || typeof item !== 'object') {
    return item;
  }

  if (Array.isArray(item)) {
    return item.map((subitem: any) => extractValue(subitem));
  }

  if (isHighlightLeaf(item)) {
    return item.value;
  }

  const values: Record<string, any> = {};
  for (const key in item) {
    if (Object.prototype.hasOwnProperty.call(item, key)) {
      values[key] = extractValue(item[key]);
    }
  }
  return values;
}
</script>
<style scoped lang="scss">
.fields {
  margin: 0;
  display: grid;
}

.field {
  display: grid;
  grid-template-columns: minmax(88px, 30%) minmax(0, 1fr);
  gap: 4px 16px;
  padding: 8px 0;
  border-top: 1px solid var(--ts-rule);
  &:first-child {
    border-top: 0;
  }
  @media (max-width: 599px) {
    grid-template-columns: minmax(0, 1fr);
  }
}

.field__name {
  font-family: var(--ts-font-mono);
  font-size: 0.75rem;
  color: var(--ts-ink-3);
  word-break: break-word;
  padding-top: 2px;
  .is-unknown > & {
    color: var(--q-warning);
  }
}

.field__count,
.field__tag {
  margin-left: 4px;
  color: var(--ts-ink-3);
}

.field__tag {
  padding: 0 6px;
  border-radius: 999px;
  background: var(--ts-primary-soft);
  color: var(--ts-primary);
  font-family: var(--ts-font-display);
}

.field__value {
  position: relative;
  margin: 0;
  min-width: 0;
  font-size: 0.875rem;
  overflow-wrap: anywhere;
}

// A joined document reads as a card inside the card.
.is-joined > .field__value {
  padding: 4px 12px;
  background: var(--ts-sheet-2);
  border: 1px solid var(--ts-rule);
  border-left: 2px solid var(--ts-primary);
  border-radius: 8px;
}

.fields--nested .field {
  grid-template-columns: minmax(72px, 36%) minmax(0, 1fr);
  padding: 6px 0;
  @media (max-width: 599px) {
    grid-template-columns: minmax(0, 1fr);
  }
}

.array-field {
  max-height: 150px;
  overflow-y: auto;
  overflow-x: hidden;
}
</style>
