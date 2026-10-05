import fs from 'node:fs/promises';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TranslatorType } from 'i18n-uuid/translator-type';
import { read1PasswordCli } from './one-password.js';
import { resolveTranslationApiKey } from './translation-credentials.js';

vi.mock('node:fs/promises', () => ({ default: { readFile: vi.fn() } }));
vi.mock('../context/project-path.js', () => ({ getProjectPath: () => '/repo/' }));
vi.mock('./one-password.js', () => ({ read1PasswordCli: vi.fn() }));

beforeEach(() => {
    vi.resetAllMocks();
    for (const key of ['OPENAI_API_KEY', 'MISTRAL_API_KEY', 'GEMINI_API_KEY']) {
        vi.stubEnv(key, undefined);
    }
    vi.mocked(fs.readFile).mockRejectedValue(Object.assign(new Error('missing'), { code: 'ENOENT' }));
    vi.mocked(read1PasswordCli).mockResolvedValue('vault-token');
});

afterEach(() => vi.unstubAllEnvs());

it.each([
    [TranslatorType.OpenAi, 'OpenAI'],
    [TranslatorType.GoogleGemini, 'Gemini'],
    [TranslatorType.MistralLarge, 'Mistral'],
    [TranslatorType.MistralSmall, 'Mistral'],
] as const)('resolves only the selected provider %s from its Token field', async (provider, item) => {
    expect(await resolveTranslationApiKey(provider)).toBe('vault-token');
    expect(read1PasswordCli).toHaveBeenCalledExactlyOnceWith(`op://DevOps Development/${item}/Token`, { optional: false });
    expect(process.env.OPENAI_API_KEY).toBeUndefined();
    expect(process.env.MISTRAL_API_KEY).toBeUndefined();
    expect(process.env.GEMINI_API_KEY).toBeUndefined();
});

it('prefers environment overrides without reading files or 1Password', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'environment-token');
    expect(await resolveTranslationApiKey(TranslatorType.OpenAi)).toBe('environment-token');
    expect(fs.readFile).not.toHaveBeenCalled();
    expect(read1PasswordCli).not.toHaveBeenCalled();
});

it('reads the translation env file explicitly without mutating the process environment', async () => {
    vi.mocked(fs.readFile).mockResolvedValue('GEMINI_API_KEY="local-token"\nOPENAI_API_KEY=other-token');
    expect(await resolveTranslationApiKey(TranslatorType.GoogleGemini)).toBe('local-token');
    expect(fs.readFile).toHaveBeenCalledWith('/repo/.development/i18n-uuid/.env', 'utf8');
    expect(read1PasswordCli).not.toHaveBeenCalled();
    expect(process.env.GEMINI_API_KEY).toBeUndefined();
    expect(process.env.OPENAI_API_KEY).toBeUndefined();
});

it('ignores blank overrides and rejects an empty vault token', async () => {
    vi.stubEnv('OPENAI_API_KEY', ' ');
    vi.mocked(fs.readFile).mockResolvedValue('OPENAI_API_KEY=" "');
    vi.mocked(read1PasswordCli).mockResolvedValue(' ');
    await expect(resolveTranslationApiKey(TranslatorType.OpenAi)).rejects.toThrow('OPENAI_API_KEY');
});

it('propagates 1Password failures', async () => {
    vi.mocked(read1PasswordCli).mockRejectedValue(new Error('1Password is locked'));
    await expect(resolveTranslationApiKey(TranslatorType.OpenAi)).rejects.toThrow('1Password is locked');
});

it('reports unreadable environment files instead of silently falling back', async () => {
    vi.mocked(fs.readFile).mockRejectedValue(Object.assign(new Error('permission denied'), { code: 'EACCES' }));
    await expect(resolveTranslationApiKey(TranslatorType.OpenAi)).rejects.toThrow('permission denied');
    expect(read1PasswordCli).not.toHaveBeenCalled();
});
