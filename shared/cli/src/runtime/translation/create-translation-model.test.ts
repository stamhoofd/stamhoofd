import { afterEach, describe, expect, it, vi } from 'vitest';
import { read1PasswordCli } from '../one-password.js';
import { resolveTranslationModel } from './create-translation-model.js';

vi.mock('../one-password.js', () => ({
    read1PasswordCli: vi.fn(async () => 'sk-from-1password'),
}));

afterEach(() => {
    vi.clearAllMocks();
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.RELEASE_NOTES_AI_PROVIDER;
    delete process.env.RELEASE_NOTES_AI_MODEL;
});

describe('resolveTranslationModel', () => {
    it('defaults to OpenAI and uses the env key when present', async () => {
        process.env.OPENAI_API_KEY = 'sk-test';
        const result = await resolveTranslationModel();
        expect('model' in result && result.model.name).toBe('openai:gpt-5.5');
        expect(read1PasswordCli).not.toHaveBeenCalled();
    });

    it('fetches the OpenAI key from 1Password when the env var is missing', async () => {
        const result = await resolveTranslationModel({ provider: 'openai' });
        expect('model' in result && result.model.name).toBe('openai:gpt-5.5');
        expect(read1PasswordCli).toHaveBeenCalledTimes(1);
        expect(process.env.OPENAI_API_KEY).toBe('sk-from-1password');
    });

    it('selects Claude when requested and the key is present', async () => {
        process.env.ANTHROPIC_API_KEY = 'sk-ant';
        const result = await resolveTranslationModel({ provider: 'claude', model: 'claude-opus-4-8' });
        expect('model' in result && result.model.name).toBe('claude:claude-opus-4-8');
    });

    it('reports Claude as unavailable when its key is missing', async () => {
        const result = await resolveTranslationModel({ provider: 'claude' });
        expect(result).toEqual({ unavailable: 'ANTHROPIC_API_KEY is not set' });
    });

    it('honours RELEASE_NOTES_AI_PROVIDER and RELEASE_NOTES_AI_MODEL', async () => {
        process.env.ANTHROPIC_API_KEY = 'sk-ant';
        process.env.RELEASE_NOTES_AI_PROVIDER = 'claude';
        process.env.RELEASE_NOTES_AI_MODEL = 'claude-sonnet-4-6';
        const result = await resolveTranslationModel();
        expect('model' in result && result.model.name).toBe('claude:claude-sonnet-4-6');
    });

    it('rejects unknown providers', async () => {
        const result = await resolveTranslationModel({ provider: 'mistral' });
        expect(result).toEqual({ unavailable: 'Unknown translation provider "mistral" (expected "openai" or "claude")' });
    });
});
