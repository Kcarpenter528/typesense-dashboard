import { describe, expect, it } from 'vitest';
import {
  buildModelPayload,
  historySchemaProblems,
  modelToForm,
  newModelForm,
  providerFor,
  validateModel,
} from './aiModels';

describe('providerFor', () => {
  it('finds the provider from the model name prefix', () => {
    expect(providerFor('nl', 'openai/gpt-4.1-mini')?.label).toBe('OpenAI');
    expect(providerFor('conversation', 'vllm/llama')?.fields[0]?.key).toBe('vllm_url');
    expect(providerFor('nl', 'vllm/llama')?.fields[0]?.key).toBe('api_url');
    expect(providerFor('conversation', 'gcp/gemini')).toBeUndefined();
    expect(providerFor('nl', 'gpt-4')).toBeUndefined();
  });
});

describe('validateModel', () => {
  it('accepts a complete new model', () => {
    const form = { ...newModelForm('nl'), model_name: 'openai/gpt-4.1-mini', api_key: 'sk-1' };
    expect(validateModel('nl', form, true)).toEqual([]);
  });

  it('requires a provider prefix and a model after it', () => {
    expect(validateModel('nl', { model_name: 'gpt-4', max_bytes: 1 }, true)[0]).toMatch(
      /must start with a provider/,
    );
    expect(
      validateModel('nl', { model_name: 'openai/', api_key: 'k', max_bytes: 1 }, true)[0],
    ).toMatch(/Add the model after/);
  });

  it("requires the provider's own settings", () => {
    const errors = validateModel(
      'conversation',
      { model_name: 'cloudflare/@cf/llama', api_key: 'k', system_prompt: 'x', max_bytes: 1 },
      true,
    );
    expect(errors).toEqual(['Account ID is required.', 'History collection is required.']);
  });

  it('lets an edit leave a saved secret empty', () => {
    const form = { model_name: 'openai/gpt-4.1-mini', api_key: '', max_bytes: 16000 };
    expect(validateModel('nl', form, true)).toEqual(['API key is required.']);
    expect(validateModel('nl', form, false)).toEqual([]);
  });

  it('rejects numbers that are not numbers', () => {
    const form = { model_name: 'vllm/x', api_url: 'http://v', max_bytes: 'lots' };
    expect(validateModel('nl', form, true)).toEqual(['Context size (bytes) must be a number.']);
  });
});

describe('buildModelPayload', () => {
  it('keeps only fields for the provider, trims text and converts numbers', () => {
    const payload = buildModelPayload(
      'nl',
      {
        id: ' my-model ',
        model_name: 'vllm/llama',
        api_url: ' http://vllm:8000 ',
        account_id: 'left over from another provider',
        max_bytes: '16000',
        temperature: '0.2',
        system_prompt: '',
      },
      true,
    );
    expect(payload).toEqual({
      id: 'my-model',
      model_name: 'vllm/llama',
      api_url: 'http://vllm:8000',
      max_bytes: 16000,
      temperature: 0.2,
    });
  });

  it('never sends the id or an empty secret when editing', () => {
    const payload = buildModelPayload(
      'conversation',
      {
        id: 'chat',
        model_name: 'openai/gpt-4.1-mini',
        api_key: '',
        history_collection: 'conversation_store',
        system_prompt: 'Be brief.',
        max_bytes: 16384,
        ttl: 3600,
      },
      false,
    );
    expect(payload).toEqual({
      model_name: 'openai/gpt-4.1-mini',
      history_collection: 'conversation_store',
      system_prompt: 'Be brief.',
      max_bytes: 16384,
      ttl: 3600,
    });
  });

  it('splits list fields', () => {
    const payload = buildModelPayload(
      'nl',
      { model_name: 'google/gemini', api_key: 'k', max_bytes: 1, stop_sequences: 'END, STOP' },
      true,
    );
    expect(payload.stop_sequences).toEqual(['END', 'STOP']);
  });
});

describe('modelToForm', () => {
  it('clears masked secrets so they are not sent back', () => {
    const form = modelToForm({ id: 'a', model_name: 'openai/x', api_key: 'sk-abcde*******mnop' });
    expect(form.api_key).toBe('');
    expect(modelToForm({ api_key: 'plain' }).api_key).toBe('plain');
  });
});

describe('historySchemaProblems', () => {
  it('accepts the documented schema and names what is wrong otherwise', () => {
    const ok = {
      fields: [
        { name: 'conversation_id', type: 'string' },
        { name: 'model_id', type: 'string' },
        { name: 'timestamp', type: 'int32' },
        { name: 'role', type: 'string' },
        { name: 'message', type: 'string' },
      ],
    };
    expect(historySchemaProblems(ok)).toEqual([]);
    expect(
      historySchemaProblems({
        fields: [{ name: 'timestamp', type: 'int64' }, ...ok.fields.slice(0, 2)],
      }),
    ).toEqual([
      '`timestamp` must be int32, not int64',
      '`role` (string) is missing',
      '`message` (string) is missing',
    ]);
  });
});
