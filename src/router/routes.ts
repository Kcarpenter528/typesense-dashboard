import type { RouteRecordRaw } from 'vue-router';
import type { PageHelpKey } from '@/shared/help';

declare module 'vue-router' {
  interface RouteMeta {
    /** The page's help topic, offered by the header's help menu. */
    help?: PageHelpKey;
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    children: [
      { path: '', component: () => import('@/pages/ServerStatus.vue'), meta: { help: 'status' } },
      {
        path: 'settings',
        component: () => import('@/pages/ServerSettings.vue'),
        meta: { help: 'settings' },
      },
      {
        path: 'aliases',
        component: () => import('@/pages/Aliases.vue'),
        meta: { help: 'aliases' },
      },
      {
        path: 'apikeys',
        component: () => import('@/pages/ApiKeys.vue'),
        meta: { help: 'apiKeys' },
      },
      {
        path: 'analytics',
        component: () => import('@/pages/SearchAnalytics.vue'),
        meta: { help: 'searchAnalytics' },
      },
      {
        path: 'analyticsrules',
        component: () => import('@/pages/AnalyticsRules.vue'),
        meta: { help: 'analytics' },
      },
      {
        path: 'searchpresets',
        component: () => import('@/pages/SearchPresets.vue'),
        meta: { help: 'presets' },
      },
      {
        path: 'stopwords',
        component: () => import('@/pages/Stopwords.vue'),
        meta: { help: 'stopwords' },
      },
      {
        path: 'stemming',
        component: () => import('@/pages/Stemming.vue'),
        meta: { help: 'stemming' },
      },
      {
        path: 'collections',
        component: () => import('@/pages/Collections.vue'),
        meta: { help: 'collections' },
      },
      {
        path: 'synonyms',
        component: () => import('@/pages/Synonyms.vue'),
        meta: { help: 'synonyms' },
      },
      {
        path: 'curations',
        component: () => import('@/pages/Overrides.vue'),
        meta: { help: 'curations' },
      },
      {
        path: 'nl-models',
        component: () => import('@/pages/AiModels.vue'),
        props: { kind: 'nl' },
        meta: { help: 'nlModels' },
      },
      {
        path: 'conversation-models',
        component: () => import('@/pages/AiModels.vue'),
        props: { kind: 'conversation' },
        meta: { help: 'conversationModels' },
      },
      {
        path: 'collection/:name',
        component: () => import('@/layouts/CollectionLayout.vue'),
        children: [
          { path: '', redirect: (to) => `/collection/${String(to.params.name)}/search` },
          {
            path: 'search',
            component: () => import('@/pages/Search.vue'),
            meta: { help: 'search' },
          },
          {
            path: 'schema',
            component: () => import('@/pages/Schema.vue'),
            meta: { help: 'schema' },
          },
          {
            path: 'document',
            component: () => import('@/pages/Document.vue'),
            meta: { help: 'documents' },
          },
          {
            path: 'synonyms',
            component: () => import('@/pages/Synonyms.vue'),
            meta: { help: 'synonyms' },
          },
          {
            path: 'curations',
            component: () => import('@/pages/Overrides.vue'),
            meta: { help: 'curations' },
          },
        ],
      },
      { path: 'help', component: () => import('@/pages/Help.vue') },
      {
        path: 'clusters',
        name: 'Clusters',
        component: () => import('@/pages/ClusterStatus.vue'),
        meta: { help: 'clusters' },
      },
    ],
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/pages/Login.vue'),
    meta: { help: 'login' },
  },
  {
    path: '/:catchAll(.*)*',
    component: () => import('@/pages/Error404.vue'),
  },
];

export default routes;
