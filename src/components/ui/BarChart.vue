<template>
  <div class="bar-chart" :style="{ height: `${height}px` }">
    <canvas ref="canvas" role="img" :aria-label="ariaLabel" />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Dark } from 'quasar';
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  LinearScale,
  Tooltip,
  type Plugin,
} from 'chart.js';
import { truncate } from '@/shared/searchAnalytics';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

const props = withDefaults(
  defineProps<{
    labels: string[];
    values: number[];
    /** Names one value in the tooltip, e.g. "searches". */
    unit?: string;
    /** `primary` for the usual ink, `warning` for things that need attention. */
    tone?: 'primary' | 'warning';
    ariaLabel?: string;
  }>(),
  { unit: '', tone: 'primary', ariaLabel: 'Bar chart' },
);

const ROW = 30;
const height = computed(() => Math.max(props.labels.length, 1) * ROW + 12);

const canvas = ref<HTMLCanvasElement>();
let chart: Chart | undefined;

/** Chart.js paints to a canvas, so the design tokens are read from the page and re-read on theme change. */
function tokens() {
  const style = getComputedStyle(document.body);
  const read = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return {
    bar:
      props.tone === 'warning' ? read('--q-warning', '#b7791f') : read('--ts-primary', '#0f766e'),
    ink: read('--ts-ink', '#14191b'),
    inkSoft: read('--ts-ink-2', '#4a5557'),
    sheet: read('--ts-sheet', '#ffffff'),
    rule: read('--ts-rule', '#dce2e0'),
    body: style.fontFamily || 'system-ui, sans-serif',
  };
}

/** Prints each value at the end of its bar, so the axis can stay out of the way. */
const valueLabels = (color: string, font: string): Plugin<'bar'> => ({
  id: 'valueLabels',
  afterDatasetsDraw(instance) {
    const { ctx } = instance;
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = `500 12px ${font}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    instance.getDatasetMeta(0).data.forEach((bar, index) => {
      const value = props.values[index];
      if (value === undefined) return;
      ctx.fillText(value.toLocaleString(), bar.x + 8, bar.y);
    });
    ctx.restore();
  },
});

function render() {
  if (!canvas.value) return;
  chart?.destroy();
  const t = tokens();
  chart = new Chart(canvas.value, {
    type: 'bar',
    data: {
      labels: props.labels,
      datasets: [
        {
          data: props.values,
          backgroundColor: t.bar,
          hoverBackgroundColor: t.bar,
          borderRadius: 4,
          borderSkipped: false,
          barThickness: 16,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 350 },
      // Room on the right for the value printed after the longest bar.
      layout: { padding: { right: 44 } },
      scales: {
        x: { display: false, beginAtZero: true },
        y: {
          border: { display: false },
          grid: { display: false },
          ticks: {
            color: t.inkSoft,
            font: { family: t.body, size: 13 },
            callback(value) {
              return truncate(props.labels[value as number] ?? '');
            },
          },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: t.sheet,
          titleColor: t.ink,
          bodyColor: t.inkSoft,
          borderColor: t.rule,
          borderWidth: 1,
          padding: 10,
          cornerRadius: 8,
          displayColors: false,
          titleFont: { family: t.body, weight: 600 },
          bodyFont: { family: t.body },
          callbacks: {
            label: (item) => `${(item.raw as number).toLocaleString()} ${props.unit}`.trim(),
          },
        },
      },
    },
    plugins: [valueLabels(t.ink, t.body)],
  });
}

onMounted(render);
onBeforeUnmount(() => chart?.destroy());
watch(() => [props.labels, props.values, props.tone], render);
// Quasar flips the body class after this watcher runs, so wait a tick before reading tokens.
watch(
  () => Dark.isActive,
  () => void nextTick(render),
);
</script>

<style scoped lang="scss">
.bar-chart {
  position: relative;
  width: 100%;
}
</style>
