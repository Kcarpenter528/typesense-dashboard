<template>
  <div class="not-found column items-center justify-center text-center">
    <div class="not-found__code">404</div>
    <h1 class="not-found__title">This page doesn't <mark>exist</mark></h1>
    <p class="not-found__body">The address may be mistyped, or the page moved in an update.</p>
    <q-btn unelevated no-caps color="primary" to="/" label="Go to server status" />
  </div>
</template>

<script setup lang="ts"></script>

<style scoped lang="scss">
.not-found {
  min-height: 100vh;
  padding: 24px;
  background: var(--ts-paper);
  color: var(--ts-ink);
}

.not-found__code {
  font-family: var(--ts-font-mono);
  font-size: 0.9rem;
  color: var(--ts-ink-3);
}

.not-found__title {
  margin: 8px 0 0;
  font-family: var(--ts-font-display);
  font-weight: 700;
  font-size: clamp(2rem, 5vw, 3rem);
  letter-spacing: -0.03em;
}

.not-found__body {
  margin: 12px 0 24px;
  color: var(--ts-ink-2);
}
</style>
