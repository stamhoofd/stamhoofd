import { beforeEach, expect, it, vi } from 'vitest';
import path from 'node:path';
import { autoTranslate } from './auto-translate.js';
import { AutoTranslator } from './AutoTranslator.js';
import { promptLogger } from './PromptLogger.js';
import { globals } from '../shared/globals.js';
import { TranslatorType } from '../enums/TranslatorType.js';

const { start } = vi.hoisted(() => ({ start: vi.fn() }));
vi.mock('./AutoTranslator.js', () => ({ AutoTranslator: vi.fn(function () { return { start }; }) }));
vi.mock('./TranslationManager.js', () => ({ TranslationManager: vi.fn(function () {}) }));
vi.mock('./PromptLogger.js', () => ({ promptLogger: { initialize: vi.fn(), close: vi.fn() } }));

beforeEach(() => vi.resetAllMocks());

it('uses the selected provider and passes credentials before starting translation', async () => {
    const onProgress = vi.fn();
    await autoTranslate({ translatorType: TranslatorType.MistralSmall, apiKey: 'test-token', locales: ['fr'], onProgress });
    expect(AutoTranslator).toHaveBeenCalledWith(TranslatorType.MistralSmall, expect.anything(), {
        translatorType: TranslatorType.MistralSmall, apiKey: 'test-token', fake: false, locales: ['fr'], onProgress,
    });
    expect(promptLogger.initialize).toHaveBeenCalledWith(path.join(globals.I18NUUID_ROOT, '.development/i18n-uuid'));
    expect(promptLogger.initialize).toHaveBeenCalledBefore(start);
    expect(promptLogger.close).toHaveBeenCalledAfter(start);
});

it('closes logs when translation fails', async () => {
    start.mockRejectedValue(new Error('translation failed'));
    await expect(autoTranslate({ fake: true })).rejects.toThrow('translation failed');
    expect(promptLogger.close).toHaveBeenCalledOnce();
});
