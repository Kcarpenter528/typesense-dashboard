<template>
  <div class="login">
    <section class="login__intro">
      <div class="brand row items-center no-wrap">
        <span class="brand__mark" aria-hidden="true">T</span>
        <span class="brand__name">Typesense <mark>Dashboard</mark></span>
      </div>
      <h1 class="login__title">Connect to your <mark>search</mark> server</h1>
      <p class="login__lead">
        Manage collections, schemas, synonyms, keys and server settings for a Typesense server you
        run or host.
      </p>
      <p v-if="!$q.platform.is.electron" class="login__note">
        The server must allow this page's origin, <code>{{ origin }}</code
        >, through CORS (<code>--enable-cors</code>).
      </p>
    </section>

    <section class="login__panel">
      <q-card flat bordered class="login__card">
        <q-form @submit="login">
          <q-card-section class="q-gutter-md">
            <div class="ts-section-title">Server</div>
            <div class="row no-wrap" style="gap: 8px">
              <q-select
                v-model="store.currentNodeConfig.protocol"
                outlined
                :options="protocolOptions"
                label="Protocol"
                style="width: 110px"
              />
              <q-input
                v-model="store.currentNodeConfig.host"
                class="col"
                outlined
                label="Host"
                placeholder="localhost"
                autocomplete="off"
              />
              <q-input
                v-model.number="store.currentNodeConfig.port"
                outlined
                type="number"
                label="Port"
                style="width: 110px"
              />
            </div>
            <q-input
              v-model="apiKey"
              outlined
              type="password"
              label="API key"
              autocomplete="current-password"
              hint="An admin key shows every page. A scoped key shows what it's allowed to see."
            >
              <template #append>
                <help-tip topic="login.api_key" />
              </template>
            </q-input>
            <q-expansion-item
              v-model="showAdvancedSettings"
              dense
              switch-toggle-side
              header-class="q-px-none ts-muted"
              label="Advanced"
            >
              <div class="q-gutter-md q-pt-sm">
                <q-input
                  v-model="store.currentNodeConfig.path"
                  outlined
                  label="Path"
                  placeholder="/typesense"
                  hint="Only when Typesense is behind a proxy under a sub-path."
                >
                  <template #append>
                    <help-tip topic="login.path" />
                  </template>
                </q-input>
                <q-input
                  v-model.number="connectionTimeoutSeconds"
                  outlined
                  type="number"
                  label="Connection timeout"
                  suffix="seconds"
                  clearable
                  hint="Leave empty for the default."
                />
                <q-toggle
                  v-if="$q.platform.is.electron && store.currentNodeConfig.protocol === 'https'"
                  v-model="store.currentNodeConfig.tls"
                  label="Verify the TLS certificate"
                />
              </div>
            </q-expansion-item>
            <div v-if="store.error" class="login__error" role="alert">
              <q-icon name="sym_s_error" size="18px" />
              <span>Couldn't connect: {{ store.error }}</span>
            </div>
            <q-btn
              unelevated
              no-caps
              color="primary"
              size="md"
              class="full-width"
              type="submit"
              label="Connect"
            />
          </q-card-section>
        </q-form>
        <template v-if="store.loginHistoryParsed.length">
          <q-separator />
          <div class="login__recent">
            <server-history />
          </div>
        </template>
      </q-card>
    </section>
  </div>
</template>

<script setup lang="ts">
import HelpTip from '@/components/help/HelpTip.vue';
import ServerHistory from '@/components/ServerHistory.vue';
import { useNodeStore } from '@/stores/node';
import { onMounted, ref } from 'vue';

const store = useNodeStore();

const protocolOptions = ['http', 'https'];
const origin = window.location.origin;
const apiKey = ref('');
const showAdvancedSettings = ref(false);
const connectionTimeoutSeconds = ref<number | null>(
  store.loginData?.connectionTimeoutSeconds ?? null,
);

onMounted(() => {
  void store.connectionCheck();
});

function login() {
  const payload: Parameters<typeof store.login>[0] = {
    apiKey: apiKey.value,
    node: store.currentNodeConfig,
  };
  if (connectionTimeoutSeconds.value !== null) {
    payload.connectionTimeoutSeconds = connectionTimeoutSeconds.value;
  }
  void store.login(payload);
}
</script>

<style scoped lang="scss">
.login {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
  min-height: 100vh;
  background: var(--ts-paper);
  @media (max-width: 899px) {
    grid-template-columns: 1fr;
  }
}

.login__intro {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 48px clamp(24px, 6vw, 96px);
}

.brand {
  gap: 10px;
  margin-bottom: 48px;
}

.brand__mark {
  display: inline-grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--ts-ink);
  color: var(--ts-paper);
  font-family: var(--ts-font-display);
  font-weight: 700;
  box-shadow: inset 0 -8px 0 var(--ts-mark);
}

.brand__name {
  font-family: var(--ts-font-display);
  font-weight: 650;
  font-size: 1.05rem;
}

.login__title {
  margin: 0;
  max-width: 14ch;
  font-family: var(--ts-font-display);
  font-weight: 700;
  font-size: clamp(2.2rem, 4.4vw, 3.6rem);
  line-height: 1.02;
  letter-spacing: -0.035em;
  color: var(--ts-ink);
}

.login__lead {
  margin: 20px 0 0;
  max-width: 44ch;
  font-size: 1.05rem;
  line-height: 1.55;
  color: var(--ts-ink-2);
}

.login__note {
  margin: 16px 0 0;
  max-width: 52ch;
  font-size: 0.85rem;
  color: var(--ts-ink-3);
}

.login__panel {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 24px;
  background: var(--ts-sheet-2);
  border-left: 1px solid var(--ts-rule);
  @media (max-width: 899px) {
    border-left: 0;
    border-top: 1px solid var(--ts-rule);
  }
}

.login__card {
  width: min(440px, 100%);
}

.login__error {
  display: flex;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--ts-danger-soft);
  color: var(--ts-ink);
  font-size: 0.85rem;
  .q-icon {
    color: var(--q-negative);
  }
}

.login__recent {
  max-height: 260px;
  overflow-y: auto;
}
</style>
