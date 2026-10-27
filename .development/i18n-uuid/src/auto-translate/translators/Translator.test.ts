import { afterEach, expect, it, vi } from 'vitest';
import { TranslatorType } from '../../enums/TranslatorType.js';
import type { Batch } from '../../types/Batch.js';
import { PromiseQueue } from '../PromiseQueue.js';
import { promptLogger } from '../PromptLogger.js';
import type { TranslationManager } from '../TranslationManager.js';
import { Translator } from './Translator.js';

class TestTranslator extends Translator {
    protected readonly maxBatchLength = 100;
    protected readonly queue = new PromiseQueue<Batch<string>>(2, 1);

    protected generateResponse(): Promise<string> {
        throw new Error('Fake translation should not call a provider');
    }
}

afterEach(() => vi.restoreAllMocks());

function createTranslator() {
    const manager = {
        getConsistentWords: () => new Map([['lid', 'member']]),
        getPrompt: () => '',
    } as unknown as TranslationManager;
    return new TestTranslator(manager, { fake: true, translatorType: TranslatorType.OpenAi, locales: undefined });
}

it('collects simple batch results into a map and encodes consistent words in prompts', async () => {
    const prompt = vi.spyOn(promptLogger, 'prompt').mockReturnValue(() => {});
    const afterBatchTranslated = vi.fn();
    const translator = createTranslator();

    const result = await translator.translateAll(new Map([['greeting', 'Hallo'], ['farewell', 'Dag']]), {
        originalLocal: 'nl', targetLocal: 'en', namespace: 'stamhoofd', afterBatchTranslated,
    });

    expect(result).toBeInstanceOf(Map);
    expect([...result.keys()]).toEqual(['greeting', 'farewell']);
    expect(result.get('greeting')).toContain('Hallo');
    expect(afterBatchTranslated.mock.calls.flatMap(([batch]) => batch).map(item => item.uuid)).toEqual(['greeting', 'farewell']);
    expect(prompt.mock.calls[0][0]).toContain('"lid": "member"');
});

it('translates variant maps using each variant as the original batch value', async () => {
    vi.spyOn(promptLogger, 'prompt').mockReturnValue(() => {});
    const translator = createTranslator();

    const result = await translator.translateAllVariants(new Map([
        ['greeting', { original: 'Hallo', translation: 'Hello', variant: 'Dag' }],
    ]), { originalLocal: 'nl', targetLocal: 'en', namespace: 'variant' });

    expect(result).toBeInstanceOf(Map);
    expect(result.get('greeting')).toContain('Dag');
});
