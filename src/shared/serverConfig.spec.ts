import { describe, expect, it } from 'vitest';
import {
  changedFlags,
  RUNTIME_SETTINGS,
  toConfigFile,
  toDockerCompose,
  toDockerRun,
  toEnvFile,
  toEnvName,
  validateRuntimeValue,
} from './serverConfig';
import type { StartupConfigOptions } from './serverConfig';

const setting = (key: string) => RUNTIME_SETTINGS.find((s) => s.key === key)!;

function options(values: StartupConfigOptions['values'] = {}): StartupConfigOptions {
  return { values, version: '30.2', dataDir: '/data', hostPort: 8108, containerName: 'typesense' };
}

describe('runtime settings', () => {
  it('lists exactly the keys Typesense 30.2 accepts at runtime', () => {
    expect(RUNTIME_SETTINGS.map((s) => s.key).sort()).toEqual([
      'cache-num-entries',
      'embedding-cache-num-entries',
      'enable-search-logging',
      'healthy-read-lag',
      'healthy-write-lag',
      'log-slow-requests-time-ms',
      'log-slow-searches-time-ms',
      'skip-writes',
    ]);
  });

  it('validates values like the server does', () => {
    expect(validateRuntimeValue(setting('log-slow-requests-time-ms'), -1)).toBeNull();
    expect(validateRuntimeValue(setting('log-slow-requests-time-ms'), -2)).toMatch(/at least -1/);
    expect(validateRuntimeValue(setting('cache-num-entries'), 0)).toMatch(/at least 1/);
    expect(validateRuntimeValue(setting('cache-num-entries'), 1.5)).toMatch(/whole number/);
    expect(validateRuntimeValue(setting('skip-writes'), true)).toBeNull();
    expect(validateRuntimeValue(setting('skip-writes'), 'yes')).not.toBeNull();
  });
});

describe('startup snippets', () => {
  it('leaves out flags that match the defaults', () => {
    expect(
      changedFlags({
        'enable-cors': false,
        'api-port': 8108,
        'cors-domains': [' '],
        'thread-pool-size': 0,
      }),
    ).toEqual([]);
  });

  it('joins list values and keeps definition order', () => {
    expect(
      changedFlags({
        'max-per-page': 100,
        'cors-domains': ['https://a.example', ' https://b.example '],
        'enable-cors': true,
      }),
    ).toEqual([
      ['enable-cors', 'true'],
      ['cors-domains', 'https://a.example,https://b.example'],
      ['max-per-page', '100'],
    ]);
  });

  it('builds environment variable names', () => {
    expect(toEnvName('cors-domains')).toBe('TYPESENSE_CORS_DOMAINS');
  });

  it('never includes a real API key', () => {
    const opts = options({ 'enable-cors': true });
    expect(toDockerRun(opts)).toContain('--api-key="$TYPESENSE_API_KEY"');
    expect(toDockerCompose(opts)).toContain('TYPESENSE_API_KEY: "${TYPESENSE_API_KEY}"');
    expect(toEnvFile(opts)).toContain('TYPESENSE_API_KEY=<your-api-key>');
    expect(toConfigFile(opts)).toContain('api-key = <your-api-key>');
  });

  it('generates a docker run command', () => {
    expect(
      toDockerRun(options({ 'enable-cors': true, 'cors-domains': ['http://localhost:9000'] })),
    ).toBe(
      [
        'docker run -d --name typesense',
        '  -p 8108:8108',
        '  -v typesense-data:/data',
        '  typesense/typesense:30.2',
        '  --data-dir=/data',
        '  --api-key="$TYPESENSE_API_KEY"',
        '  --enable-cors=true',
        '  --cors-domains=http://localhost:9000',
      ].join(' \\\n'),
    );
  });

  it('maps a custom API port inside the container', () => {
    expect(toDockerRun(options({ 'api-port': 9090 }))).toContain('-p 8108:9090');
  });

  it('quotes shell values that need it', () => {
    expect(toDockerRun(options({ 'log-dir': "/var/my logs/it's" }))).toContain(
      `--log-dir='/var/my logs/it'\\''s'`,
    );
  });

  it('generates docker compose, env and config files', () => {
    const opts = options({ 'enable-cors': true });
    expect(toDockerCompose(opts)).toContain('      TYPESENSE_ENABLE_CORS: "true"');
    expect(toEnvFile(opts).split('\n')).toContain('TYPESENSE_ENABLE_CORS=true');
    expect(toConfigFile(opts).split('\n')).toEqual([
      '[server]',
      'data-dir = /data',
      'api-key = <your-api-key>',
      'enable-cors = true',
    ]);
  });
});
