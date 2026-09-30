<template>
  <div ref="editorWrapper" class="col relative-position overflow-hidden editorWrapper">
    <q-resize-observer @resize="onResize" />
    <div ref="editorElement" class="absolute-top-left"></div>
  </div>
</template>
<script setup lang="ts">
import * as monaco from 'monaco-editor';
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { Dark } from 'quasar';

// Editor themes that match the app's paper-and-ink surfaces in both modes.
monaco.editor.defineTheme('ts-light', {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'string.key.json', foreground: '0f766e' },
    { token: 'string.value.json', foreground: '8a4b0f' },
    { token: 'number', foreground: '3346a8' },
    { token: 'keyword.json', foreground: '9b2c6b' },
  ],
  colors: {
    'editor.background': '#ffffff',
    'editorGutter.background': '#f9faf9',
    'editorLineNumber.foreground': '#a7b0af',
    'editor.lineHighlightBackground': '#f4f6f5',
    'editor.selectionBackground': '#ffe37a88',
  },
});
monaco.editor.defineTheme('ts-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'string.key.json', foreground: '5fd4c6' },
    { token: 'string.value.json', foreground: 'e8c07a' },
    { token: 'number', foreground: '9fb4ff' },
    { token: 'keyword.json', foreground: 'f09ac8' },
  ],
  colors: {
    'editor.background': '#151c1f',
    'editorGutter.background': '#11181a',
    'editorLineNumber.foreground': '#4d5b5e',
    'editor.lineHighlightBackground': '#1a2326',
    'editor.selectionBackground': '#ffd84d44',
  },
});

import editorWorker from 'monaco-editor/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/language/json/json.worker?worker';

(self as any).MonacoEnvironment = {
  getWorker(_: any, label: string) {
    if (label === 'json') {
      return new jsonWorker();
    }
    return new editorWorker();
  },
};

interface Props {
  modelValue?: string;
  options?: monaco.editor.IStandaloneEditorConstructionOptions;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  options: () => ({}),
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const editorElement = ref<HTMLElement | null>(null);
const editorWrapper = ref<HTMLElement | null>(null);
let editor: monaco.editor.IStandaloneCodeEditor | undefined;

onMounted(() => {
  if (!editorElement.value) return;

  editor = monaco.editor.create(editorElement.value, {
    value: props.modelValue,
    language: 'json',
    theme: Dark.isActive ? 'ts-dark' : 'ts-light',
    fontFamily: "'IBM Plex Mono', ui-monospace, Consolas, monospace",
    fontSize: 13,
    lineHeight: 20,
    padding: { top: 10, bottom: 10 },
    scrollBeyondLastLine: false,
    renderLineHighlight: 'gutter',
    minimap: {
      enabled: false,
    },
    ...props.options,
  });
  editor.onDidChangeModelContent(() => {
    if (editor) emit('update:modelValue', editor.getValue());
  });
});

watch(
  () => Dark.isActive,
  (dark) => monaco.editor.setTheme(dark ? 'ts-dark' : 'ts-light'),
);

onUnmounted(() => {
  editor?.dispose();
});

watch(
  () => props.modelValue,
  (modelValue) => {
    if (modelValue !== editor?.getValue()) {
      editor?.getModel()?.setValue(modelValue);
      editor?.setScrollPosition({ scrollTop: 0 });
    }
  },
);

function onResize() {
  editor?.layout({ height: 0, width: 0 });
  window.setTimeout(() => {
    if (!editorWrapper.value) return;
    editor?.layout({
      height: editorWrapper.value.offsetHeight,
      width: editorWrapper.value.offsetWidth,
    });
  });
}
</script>

<style scoped>
.editorWrapper {
  background-color: var(--ts-sheet);
}
</style>
