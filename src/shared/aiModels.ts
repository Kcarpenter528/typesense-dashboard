/*
 * Natural-language search models and conversation models both point Typesense at an
 * LLM. Which settings a model needs depends on its provider, which is the prefix of
 * `model_name` (`openai/gpt-4o-mini`, `vllm/llama3`, …). This describes the providers
 * each kind supports, and turns the form into the body the server expects.
 */

export type ModelKind = 'nl' | 'conversation';

export interface ModelField {
  key: string;
  label: string;
  type: 'text' | 'secret' | 'number' | 'textarea' | 'list';
  required?: boolean;
  hint?: string;
  placeholder?: string;
  /** A FIELD_HELP topic explaining the setting. */
  help?: string;
}

export interface Provider {
  prefix: string;
  label: string;
  example: string;
  fields: ModelField[];
}

const apiKey: ModelField = { key: 'api_key', label: 'API key', type: 'secret', required: true };

export const PROVIDERS: Record<ModelKind, Provider[]> = {
  nl: [
    { prefix: 'openai/', label: 'OpenAI', example: 'openai/gpt-4.1-mini', fields: [apiKey] },
    {
      prefix: 'azure/',
      label: 'Azure OpenAI',
      example: 'azure/my-deployment',
      fields: [
        apiKey,
        {
          key: 'api_url',
          label: 'Endpoint URL',
          type: 'text',
          required: true,
          placeholder: 'https://my-resource.openai.azure.com',
        },
      ],
    },
    {
      prefix: 'google/',
      label: 'Google Gemini',
      example: 'google/gemini-2.5-flash',
      fields: [
        apiKey,
        { key: 'top_p', label: 'Top P', type: 'number' },
        { key: 'top_k', label: 'Top K', type: 'number' },
        {
          key: 'stop_sequences',
          label: 'Stop sequences',
          type: 'list',
          hint: 'Text that ends the response',
        },
      ],
    },
    {
      prefix: 'gcp/',
      label: 'Google Vertex AI',
      example: 'gcp/gemini-2.5-flash',
      fields: [
        { key: 'project_id', label: 'Project ID', type: 'text', required: true },
        { key: 'region', label: 'Region', type: 'text', placeholder: 'us-central1' },
        { key: 'access_token', label: 'Access token', type: 'secret' },
        { key: 'refresh_token', label: 'Refresh token', type: 'secret' },
        { key: 'client_id', label: 'OAuth client ID', type: 'text' },
        { key: 'client_secret', label: 'OAuth client secret', type: 'secret' },
      ],
    },
    {
      prefix: 'cloudflare/',
      label: 'Cloudflare Workers AI',
      example: 'cloudflare/@cf/meta/llama-3.1-8b-instruct',
      fields: [apiKey, { key: 'account_id', label: 'Account ID', type: 'text', required: true }],
    },
    {
      prefix: 'vllm/',
      label: 'vLLM (self-hosted)',
      example: 'vllm/meta-llama/Llama-3.1-8B-Instruct',
      fields: [
        {
          key: 'api_url',
          label: 'Server URL',
          type: 'text',
          required: true,
          placeholder: 'http://vllm:8000',
        },
        { key: 'api_key', label: 'API key', type: 'secret' },
      ],
    },
  ],
  conversation: [
    {
      prefix: 'openai/',
      label: 'OpenAI',
      example: 'openai/gpt-4.1-mini',
      fields: [
        apiKey,
        {
          key: 'openai_url',
          label: 'Base URL',
          type: 'text',
          hint: 'For OpenAI-compatible services; leave empty for OpenAI',
        },
        { key: 'openai_path', label: 'Path', type: 'text', placeholder: '/v1/chat/completions' },
      ],
    },
    {
      prefix: 'azure/',
      label: 'Azure OpenAI',
      example: 'azure/my-deployment',
      fields: [
        apiKey,
        {
          key: 'url',
          label: 'Endpoint URL',
          type: 'text',
          required: true,
          placeholder: 'https://my-resource.openai.azure.com',
        },
      ],
    },
    {
      prefix: 'google/',
      label: 'Google Gemini',
      example: 'google/gemini-2.5-flash',
      fields: [apiKey],
    },
    {
      prefix: 'cloudflare/',
      label: 'Cloudflare Workers AI',
      example: 'cloudflare/@cf/meta/llama-3.1-8b-instruct',
      fields: [apiKey, { key: 'account_id', label: 'Account ID', type: 'text', required: true }],
    },
    {
      prefix: 'vllm/',
      label: 'vLLM (self-hosted)',
      example: 'vllm/meta-llama/Llama-3.1-8B-Instruct',
      fields: [
        {
          key: 'vllm_url',
          label: 'Server URL',
          type: 'text',
          required: true,
          placeholder: 'http://vllm:8000',
        },
      ],
    },
  ],
};

/** Settings every model of a kind has, whatever the provider. */
export const COMMON_FIELDS: Record<ModelKind, ModelField[]> = {
  nl: [
    {
      key: 'max_bytes',
      label: 'Context size (bytes)',
      type: 'number',
      required: true,
      hint: 'How much of the collection schema is sent to the model. 16000 suits most models',
      help: 'nl.max_bytes',
    },
    {
      key: 'temperature',
      label: 'Temperature',
      type: 'number',
      hint: '0 gives the most predictable filters. Default 0',
    },
    {
      key: 'system_prompt',
      label: 'Extra instructions',
      type: 'textarea',
      hint: 'Added to the built-in prompt, e.g. how your field names map to plain words',
      help: 'nl.system_prompt',
    },
  ],
  conversation: [
    {
      key: 'history_collection',
      label: 'History collection',
      type: 'text',
      required: true,
      hint: 'Where conversations are stored',
      help: 'conversation.history_collection',
    },
    {
      key: 'system_prompt',
      label: 'System prompt',
      type: 'textarea',
      required: true,
      placeholder: 'You are an assistant for … Answer only from the documents provided.',
      help: 'conversation.system_prompt',
    },
    {
      key: 'max_bytes',
      label: 'Context size (bytes)',
      type: 'number',
      required: true,
      hint: 'How much of the search results and history is sent to the model',
      help: 'conversation.max_bytes',
    },
    {
      key: 'ttl',
      label: 'Keep conversations for (seconds)',
      type: 'number',
      hint: 'Default 86400 (one day)',
      help: 'conversation.ttl',
    },
  ],
};

/** Fields whose saved value the server never returns in full. */
export const SECRET_KEYS = ['api_key', 'access_token', 'refresh_token', 'client_secret'] as const;

export type ModelForm = Record<string, unknown> & { id?: string; model_name?: string };

export function providerFor(kind: ModelKind, modelName: string | undefined): Provider | undefined {
  if (!modelName) return undefined;
  return PROVIDERS[kind].find((p) => modelName.startsWith(p.prefix));
}

export function fieldsFor(kind: ModelKind, modelName: string | undefined): ModelField[] {
  return [...(providerFor(kind, modelName)?.fields ?? []), ...COMMON_FIELDS[kind]];
}

function isBlank(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.trim() === '') ||
    (Array.isArray(value) && value.length === 0)
  );
}

/**
 * Lists what is missing or wrong. When editing, secrets may be left empty to keep the
 * saved value, since the server only ever returns them masked.
 */
export function validateModel(kind: ModelKind, form: ModelForm, isNew: boolean): string[] {
  const errors: string[] = [];
  const provider = providerFor(kind, form.model_name);
  if (isBlank(form.model_name)) {
    errors.push('Enter a model name.');
  } else if (!provider) {
    errors.push(
      `The model name must start with a provider: ${PROVIDERS[kind].map((p) => p.prefix).join(', ')}`,
    );
  } else if (form.model_name === provider.prefix) {
    errors.push(`Add the model after \`${provider.prefix}\`, e.g. \`${provider.example}\`.`);
  }
  for (const field of fieldsFor(kind, form.model_name)) {
    if (!field.required || !isBlank(form[field.key])) continue;
    if (!isNew && field.type === 'secret') continue;
    errors.push(`${field.label} is required.`);
  }
  for (const field of fieldsFor(kind, form.model_name)) {
    const value = form[field.key];
    if (field.type === 'number' && !isBlank(value) && !Number.isFinite(Number(value))) {
      errors.push(`${field.label} must be a number.`);
    }
  }
  return errors;
}

/**
 * Builds the create/update body: only the fields that apply to the provider, no empty
 * values, numbers as numbers. When editing, an empty secret is left out so the server
 * keeps the saved one.
 */
export function buildModelPayload(
  kind: ModelKind,
  form: ModelForm,
  isNew: boolean,
): Record<string, unknown> {
  const payload: Record<string, unknown> = { model_name: String(form.model_name ?? '').trim() };
  if (isNew && !isBlank(form.id)) payload.id = String(form.id).trim();
  for (const field of fieldsFor(kind, form.model_name)) {
    const value = form[field.key];
    if (isBlank(value)) continue;
    if (!isNew && field.type === 'secret' && isMasked(value)) continue;
    if (field.type === 'number') payload[field.key] = Number(value);
    else if (field.type === 'list') {
      payload[field.key] = (Array.isArray(value) ? value : String(value).split(','))
        .map((v) => String(v).trim())
        .filter(Boolean);
    } else payload[field.key] = typeof value === 'string' ? value.trim() : value;
  }
  return payload;
}

/** The server returns saved secrets masked, e.g. `sk-a***`. */
export function isMasked(value: unknown): boolean {
  return typeof value === 'string' && value.includes('***');
}

/** Starting values for a new model of a kind. */
export function newModelForm(kind: ModelKind): ModelForm {
  return kind === 'nl'
    ? { id: '', model_name: 'openai/', max_bytes: 16000, temperature: 0 }
    : { id: '', model_name: 'openai/', max_bytes: 16384, ttl: 86400, history_collection: '' };
}

/** Turns a saved model into form values, clearing masked secrets. */
export function modelToForm(model: Record<string, unknown>): ModelForm {
  const form: ModelForm = { ...model };
  for (const key of SECRET_KEYS) {
    if (isMasked(form[key])) form[key] = '';
  }
  return form;
}

/** The schema Typesense requires for a conversation model's history collection. */
export function historyCollectionSchema(name: string) {
  return {
    name,
    fields: [
      { name: 'conversation_id', type: 'string' },
      { name: 'model_id', type: 'string' },
      { name: 'timestamp', type: 'int32' },
      { name: 'role', type: 'string', index: false },
      { name: 'message', type: 'string', index: false },
    ],
  };
}

/** Checks an existing collection against the required history schema. */
export function historySchemaProblems(collection: {
  fields?: { name: string; type: string }[];
}): string[] {
  const fields = new Map((collection.fields ?? []).map((f) => [f.name, f.type]));
  return historyCollectionSchema('')
    .fields.filter((f) => fields.get(f.name) !== f.type)
    .map((f) =>
      fields.has(f.name)
        ? `\`${f.name}\` must be ${f.type}, not ${fields.get(f.name)}`
        : `\`${f.name}\` (${f.type}) is missing`,
    );
}
