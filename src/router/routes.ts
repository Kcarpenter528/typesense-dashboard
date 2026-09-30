import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    children: [
      { path: '', component: () => import('@/pages/ServerStatus.vue') },
      { path: 'settings', component: () => import('@/pages/ServerSettings.vue') },
      { path: 'aliases', component: () => import('@/pages/Aliases.vue') },
      { path: 'apikeys', component: () => import('@/pages/ApiKeys.vue') },
      { path: 'analyticsrules', component: () => import('@/pages/AnalyticsRules.vue') },
      { path: 'searchpresets', component: () => import('@/pages/SearchPresets.vue') },
      { path: 'stopwords', component: () => import('@/pages/Stopwords.vue') },
      { path: 'stemming', component: () => import('@/pages/Stemming.vue') },
      { path: 'collections', component: () => import('@/pages/Collections.vue') },
      { path: 'synonyms', component: () => import('@/pages/Synonyms.vue') },
      { path: 'curations', component: () => import('@/pages/Overrides.vue') },
      {
        path: 'nl-models',
        component: () => import('@/pages/AiModels.vue'),
        props: { kind: 'nl' },
      },
      {
        path: 'conversation-models',
        component: () => import('@/pages/AiModels.vue'),
        props: { kind: 'conversation' },
      },
      {
        path: 'collection/:name',
        component: () => import('@/layouts/CollectionLayout.vue'),
        children: [
          { path: '', redirect: (to) => `/collection/${String(to.params.name)}/search` },
          { path: 'search', component: () => import('@/pages/Search.vue') },
          { path: 'schema', component: () => import('@/pages/Schema.vue') },
          { path: 'document', component: () => import('@/pages/Document.vue') },
          { path: 'synonyms', component: () => import('@/pages/Synonyms.vue') },
          { path: 'curations', component: () => import('@/pages/Overrides.vue') },
        ],
      },
      { path: 'clusters', name: 'Clusters', component: () => import('@/pages/ClusterStatus.vue') },
    ],
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/pages/Login.vue'),
  },
  {
    path: '/:catchAll(.*)*',
    component: () => import('@/pages/Error404.vue'),
  },
];

export default routes;
