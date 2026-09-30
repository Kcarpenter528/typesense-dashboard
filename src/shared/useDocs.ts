import { computed } from 'vue';
import { useNodeStore } from '@/stores/node';
import { apiReferenceUrl, docUrl, docsVersion } from './help';
import type { DocLink } from './help';

/** Documentation links for the connected server's version. */
export function useDocs() {
  const store = useNodeStore();
  const serverVersion = computed(() => store.data.debug?.version as unknown);

  return {
    version: computed(() => docsVersion(serverVersion.value)),
    apiReference: computed(() => apiReferenceUrl(serverVersion.value)),
    url: (link: DocLink) => docUrl(link, serverVersion.value),
    /**
     * In the desktop app, opens links in the system browser instead of a new
     * Electron window. In a browser the link's own target="_blank" does it.
     */
    openExternal(event: Event, url: string) {
      const electron = (window as { electron?: { openExternal?: (url: string) => void } }).electron;
      if (electron?.openExternal) {
        event.preventDefault();
        electron.openExternal(url);
      }
    },
  };
}
