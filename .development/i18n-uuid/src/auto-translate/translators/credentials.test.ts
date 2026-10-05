import { beforeEach, expect, it, vi } from 'vitest';
import OpenAI from 'openai';
import { Mistral } from '@mistralai/mistralai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { OpenAiTranslator } from './OpenAiTranslator.js';
import { MistralLargeTranslator, MistralSmallTranslator } from './MistralTranslator.js';
import { GoogleGeminiTranslator } from './GoogleGeminiTranslator.js';
import { TranslatorType } from '../../enums/TranslatorType.js';
import type { TranslationManager } from '../TranslationManager.js';

vi.mock('openai', () => ({ default: vi.fn(function () {}) }));
vi.mock('@mistralai/mistralai', () => ({ Mistral: vi.fn(function () {}) }));
vi.mock('@google/generative-ai', async importOriginal => ({
    ...await importOriginal<typeof import('@google/generative-ai')>(),
    GoogleGenerativeAI: vi.fn(function () { return { getGenerativeModel: vi.fn() }; }),
}));

beforeEach(() => vi.clearAllMocks());

it.each([
    [TranslatorType.OpenAi, OpenAiTranslator, OpenAI],
    [TranslatorType.GoogleGemini, GoogleGeminiTranslator, GoogleGenerativeAI],
    [TranslatorType.MistralLarge, MistralLargeTranslator, Mistral],
    [TranslatorType.MistralSmall, MistralSmallTranslator, Mistral],
] as const)('passes the explicit key to %s and skips SDK construction in fake mode', (translatorType, Provider, Client) => {
    const manager = {} as TranslationManager;
    const options = { translatorType, locales: ['fr'], fake: false, apiKey: 'explicit-test-token' };
    new Provider(manager, options);
    expect(Client).toHaveBeenCalledExactlyOnceWith(translatorType === TranslatorType.GoogleGemini ? 'explicit-test-token' : { apiKey: 'explicit-test-token' });
    vi.mocked(Client).mockClear();
    new Provider(manager, { ...options, fake: true, apiKey: undefined });
    expect(Client).not.toHaveBeenCalled();
});
