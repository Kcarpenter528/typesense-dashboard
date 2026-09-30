/**
 * Typesense server configuration: the settings that can be changed on a running
 * server through `POST /config`, and the startup flags that need a restart.
 *
 * The runtime keys mirror `Config::update_config` in Typesense 30.2
 * (src/tsconfig.cpp). The server ignores any other key and still answers
 * `{"success": true}`, so only these are offered.
 */

export type SettingValue = number | boolean | string | string[];

interface BaseSetting {
  key: string;
  label: string;
  description: string;
  group: string;
}

export interface NumberSetting extends BaseSetting {
  type: 'number';
  default: number;
  /** Smallest accepted value. */
  min?: number;
  unit?: string;
}

export interface BooleanSetting extends BaseSetting {
  type: 'boolean';
  default: boolean;
}

export interface StringSetting extends BaseSetting {
  type: 'string';
  default: string;
  placeholder?: string;
}

export interface ListSetting extends BaseSetting {
  type: 'list';
  default: string[];
  placeholder?: string;
}

export type RuntimeSetting = (NumberSetting | BooleanSetting) & {
  /** Asks for confirmation before applying a non-default value. */
  danger?: string;
};

export type StartupFlag = NumberSetting | BooleanSetting | StringSetting | ListSetting;

export const RUNTIME_SETTINGS: RuntimeSetting[] = [
  {
    key: 'log-slow-requests-time-ms',
    label: 'Log slow requests',
    type: 'number',
    default: -1,
    min: -1,
    unit: 'ms',
    group: 'Logging',
    description:
      'Log any request that takes longer than this, prefixed with SLOW REQUEST. -1 turns it off.',
  },
  {
    key: 'log-slow-searches-time-ms',
    label: 'Log slow searches',
    type: 'number',
    default: 30000,
    min: -1,
    unit: 'ms',
    group: 'Logging',
    description: 'Log searches that take longer than this. -1 turns it off.',
  },
  {
    key: 'enable-search-logging',
    label: 'Log every search',
    type: 'boolean',
    default: false,
    group: 'Logging',
    description:
      'Write each search request, including the client IP address, to the server log. Useful for debugging; noisy and privacy-sensitive in production.',
  },
  {
    key: 'cache-num-entries',
    label: 'Search cache size',
    type: 'number',
    default: 1000,
    min: 1,
    unit: 'entries',
    group: 'Caching',
    description: 'Number of search responses kept in the cache used by `use_cache=true` searches.',
  },
  {
    key: 'embedding-cache-num-entries',
    label: 'Embedding cache size',
    type: 'number',
    default: 100,
    min: 1,
    unit: 'entries',
    group: 'Caching',
    description: 'Number of query embeddings kept in memory for semantic and hybrid search.',
  },
  {
    key: 'healthy-read-lag',
    label: 'Healthy read lag',
    type: 'number',
    default: 1000,
    min: 1,
    unit: 'updates',
    group: 'Health',
    description:
      'Reject reads (and report unhealthy) when this many updates are waiting to be applied.',
  },
  {
    key: 'healthy-write-lag',
    label: 'Healthy write lag',
    type: 'number',
    default: 500,
    min: 1,
    unit: 'updates',
    group: 'Health',
    description:
      'Reject writes (and report unhealthy) when this many updates are waiting to be applied.',
  },
  {
    key: 'skip-writes',
    label: 'Reject all writes',
    type: 'boolean',
    default: false,
    group: 'Maintenance',
    description:
      'Make the node read-only: data changes fail with "Skipping writes." while searches keep working. Intended for recovering a node that crashes while replaying writes.',
    danger:
      'Every change to data on this node (documents, collections, aliases, API keys) will be rejected until you turn this off again here. Searches keep working.',
  },
];

export const STARTUP_FLAGS: StartupFlag[] = [
  {
    key: 'enable-cors',
    label: 'Enable CORS',
    type: 'boolean',
    default: false,
    group: 'CORS',
    description: 'Allow browsers to call the API from other origins, e.g. this dashboard.',
  },
  {
    key: 'cors-domains',
    label: 'Allowed origins',
    type: 'list',
    default: [],
    placeholder: 'https://app.example.com',
    group: 'CORS',
    description:
      'Only these origins may call the API from a browser. Leave empty to allow any origin when CORS is enabled.',
  },
  {
    key: 'api-port',
    label: 'API port',
    type: 'number',
    default: 8108,
    min: 1,
    group: 'Networking',
    description: 'Port the API listens on inside the container or host.',
  },
  {
    key: 'api-address',
    label: 'API address',
    type: 'string',
    default: '0.0.0.0',
    group: 'Networking',
    description: 'Address the API binds to.',
  },
  {
    key: 'ssl-certificate',
    label: 'SSL certificate',
    type: 'string',
    default: '',
    placeholder: '/etc/typesense/cert.pem',
    group: 'Networking',
    description: 'Path to a certificate file to serve HTTPS.',
  },
  {
    key: 'ssl-certificate-key',
    label: 'SSL certificate key',
    type: 'string',
    default: '',
    placeholder: '/etc/typesense/key.pem',
    group: 'Networking',
    description: 'Path to the private key for the certificate.',
  },
  {
    key: 'log-dir',
    label: 'Log directory',
    type: 'string',
    default: '',
    placeholder: '/var/log/typesense',
    group: 'Logging',
    description: 'Write logs to files in this directory instead of stdout.',
  },
  {
    key: 'enable-access-logging',
    label: 'Access logging',
    type: 'boolean',
    default: false,
    group: 'Logging',
    description: 'Log every API request with the client IP address.',
  },
  {
    key: 'log-slow-requests-time-ms',
    label: 'Log slow requests',
    type: 'number',
    default: -1,
    min: -1,
    group: 'Logging',
    description: 'Threshold in ms for logging slow requests. -1 turns it off.',
  },
  {
    key: 'enable-search-logging',
    label: 'Log every search',
    type: 'boolean',
    default: false,
    group: 'Logging',
    description: 'Write each search request to the log.',
  },
  {
    key: 'enable-search-analytics',
    label: 'Search analytics',
    type: 'boolean',
    default: false,
    group: 'Analytics',
    description: 'Collect query analytics. Required for analytics rules.',
  },
  {
    key: 'analytics-dir',
    label: 'Analytics directory',
    type: 'string',
    default: '',
    placeholder: '/data/analytics',
    group: 'Analytics',
    description: 'Where analytics events are stored.',
  },
  {
    key: 'analytics-flush-interval',
    label: 'Analytics flush interval',
    type: 'number',
    default: 3600,
    min: 1,
    unit: 's',
    group: 'Analytics',
    description: 'How often aggregated analytics are written to collections.',
  },
  {
    key: 'cache-num-entries',
    label: 'Search cache size',
    type: 'number',
    default: 1000,
    min: 1,
    group: 'Resources',
    description: 'Number of cached search responses.',
  },
  {
    key: 'thread-pool-size',
    label: 'Thread pool size',
    type: 'number',
    default: 0,
    min: 0,
    group: 'Resources',
    description:
      'Threads handling requests. 0 keeps the default, based on the number of CPU cores.',
  },
  {
    key: 'memory-used-max-percentage',
    label: 'Max memory used',
    type: 'number',
    default: 100,
    min: 1,
    unit: '%',
    group: 'Resources',
    description: 'Reject writes when memory use goes above this.',
  },
  {
    key: 'disk-used-max-percentage',
    label: 'Max disk used',
    type: 'number',
    default: 100,
    min: 1,
    unit: '%',
    group: 'Resources',
    description: 'Reject writes when disk use goes above this.',
  },
  {
    key: 'healthy-read-lag',
    label: 'Healthy read lag',
    type: 'number',
    default: 1000,
    min: 1,
    group: 'Resources',
    description: 'Pending updates before reads are rejected.',
  },
  {
    key: 'healthy-write-lag',
    label: 'Healthy write lag',
    type: 'number',
    default: 500,
    min: 1,
    group: 'Resources',
    description: 'Pending updates before writes are rejected.',
  },
  {
    key: 'snapshot-interval-seconds',
    label: 'Snapshot interval',
    type: 'number',
    default: 3600,
    min: 1,
    unit: 's',
    group: 'Resources',
    description: 'How often the replication log is snapshotted.',
  },
  {
    key: 'max-per-page',
    label: 'Max hits per page',
    type: 'number',
    default: 250,
    min: 1,
    group: 'Search limits',
    description: 'Largest `per_page` a search may ask for.',
  },
  {
    key: 'filter-by-max-ops',
    label: 'Max filter operations',
    type: 'number',
    default: 100,
    min: 1,
    group: 'Search limits',
    description: 'Most operators allowed in one `filter_by`.',
  },
  {
    key: 'max-group-limit',
    label: 'Max group limit',
    type: 'number',
    default: 99,
    min: 1,
    group: 'Search limits',
    description: 'Largest `group_limit` a search may ask for.',
  },
];

export function groupBy<T extends { group: string }>(items: T[]): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    groups.set(item.group, [...(groups.get(item.group) ?? []), item]);
  }
  return Array.from(groups.entries());
}

/** Checks a runtime setting value the same way the server does, so errors show before sending. */
export function validateRuntimeValue(setting: RuntimeSetting, value: unknown): string | null {
  if (setting.type === 'boolean') {
    return typeof value === 'boolean' ? null : 'Must be on or off';
  }
  if (typeof value !== 'number' || !Number.isInteger(value)) return 'Must be a whole number';
  if (setting.min !== undefined && value < setting.min) return `Must be at least ${setting.min}`;
  return null;
}

// ---------------------------------------------------------------------------
// Startup configuration snippets
// ---------------------------------------------------------------------------

export interface StartupConfigOptions {
  /** Flag values; flags equal to their default are left out of the output. */
  values: Record<string, SettingValue>;
  version: string;
  dataDir: string;
  hostPort: number;
  containerName: string;
}

/**
 * The API key never appears in generated output. Compose files and shells substitute
 * variables, so those reference one; env and config files are read literally, so
 * those get a placeholder to replace by hand.
 */
export const API_KEY_VARIABLE = '${TYPESENSE_API_KEY}';
export const API_KEY_PLACEHOLDER = '<your-api-key>';

function isDefault(flag: StartupFlag, value: SettingValue | undefined): boolean {
  if (value === undefined || value === '') return true;
  if (flag.type === 'list') {
    return !Array.isArray(value) || value.filter((v) => v.trim()).length === 0;
  }
  if (flag.key === 'thread-pool-size' && value === 0) return true;
  return value === flag.default;
}

function formatValue(value: SettingValue): string {
  if (Array.isArray(value)) {
    return value
      .map((v) => v.trim())
      .filter(Boolean)
      .join(',');
  }
  return String(value);
}

/** Flags that differ from the defaults, in definition order, as [flag, value] pairs. */
export function changedFlags(values: Record<string, SettingValue>): [string, string][] {
  return STARTUP_FLAGS.filter((flag) => !isDefault(flag, values[flag.key])).map((flag) => [
    flag.key,
    formatValue(values[flag.key] as SettingValue),
  ]);
}

export function toEnvName(flag: string): string {
  return `TYPESENSE_${flag.toUpperCase().replace(/-/g, '_')}`;
}

function containerPort(options: StartupConfigOptions): number {
  const port = options.values['api-port'];
  return typeof port === 'number' && port > 0 ? port : 8108;
}

function shellQuote(value: string): string {
  return /^[\w@%+=:,./-]+$/.test(value) ? value : `'${value.replace(/'/g, `'\\''`)}'`;
}

export function toDockerRun(options: StartupConfigOptions): string {
  const flags = changedFlags(options.values);
  const lines = [
    `docker run -d --name ${options.containerName}`,
    `  -p ${options.hostPort}:${containerPort(options)}`,
    `  -v typesense-data:${options.dataDir}`,
    `  typesense/typesense:${options.version}`,
    `  --data-dir=${options.dataDir}`,
    `  --api-key="$TYPESENSE_API_KEY"`,
    ...flags.map(([key, value]) => `  --${key}=${shellQuote(value)}`),
  ];
  return lines.join(' \\\n');
}

export function toDockerCompose(options: StartupConfigOptions): string {
  const env = [
    ['TYPESENSE_DATA_DIR', options.dataDir],
    ['TYPESENSE_API_KEY', API_KEY_VARIABLE],
    ...changedFlags(options.values).map(([key, value]) => [toEnvName(key), value]),
  ];
  return [
    'services:',
    '  typesense:',
    `    image: typesense/typesense:${options.version}`,
    `    container_name: ${options.containerName}`,
    '    restart: unless-stopped',
    '    ports:',
    `      - "${options.hostPort}:${containerPort(options)}"`,
    '    volumes:',
    `      - typesense-data:${options.dataDir}`,
    '    environment:',
    ...env.map(([name, value]) => `      ${name}: "${String(value).replace(/"/g, '\\"')}"`),
    'volumes:',
    '  typesense-data:',
  ].join('\n');
}

export function toEnvFile(options: StartupConfigOptions): string {
  return [
    `TYPESENSE_DATA_DIR=${options.dataDir}`,
    `TYPESENSE_API_KEY=${API_KEY_PLACEHOLDER}`,
    ...changedFlags(options.values).map(([key, value]) => `${toEnvName(key)}=${value}`),
  ].join('\n');
}

export function toConfigFile(options: StartupConfigOptions): string {
  return [
    '[server]',
    `data-dir = ${options.dataDir}`,
    `api-key = ${API_KEY_PLACEHOLDER}`,
    ...changedFlags(options.values).map(([key, value]) => `${key} = ${value}`),
  ].join('\n');
}
