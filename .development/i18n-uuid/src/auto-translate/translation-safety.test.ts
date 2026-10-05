import { afterEach, expect, it, vi } from 'vitest';
import { AutoTranslatorPostValidator } from './AutoTranslatorPostValidator.js';
import { TranslationManager } from './TranslationManager.js';
import { promptYesNoOrDoubt, YesNoOrDoubt } from '../shared/prompt-helper.js';

vi.mock('child_process', async original => ({ ...await original<typeof import('child_process')>(), exec: vi.fn((_command: string, callback: (error: Error) => void) => {
    callback(new Error('build failed'));
    return {};
}) }));
vi.mock('../shared/prompt-helper.js', async original => ({ ...await original<typeof import('../shared/prompt-helper.js')>(), promptYesNoOrDoubt: vi.fn() }));

afterEach(() => vi.restoreAllMocks());

it.each([0, 1, 2])('reports exactly %i invalid translations once per locale', async (count) => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const dictionary = Object.fromEntries(Array.from({ length: count }, (_, i) => [`%${i}`, { original: 'Account', translation: 'Account' }]));
    const manager = {
        iterateNonDefaultLocalesWithNamespaceAsync: async (callback: (locale: string, namespace: string) => Promise<void>) => await callback('en', 'stamhoofd'),
        readMachineTranslationDictionary: () => ({ ...dictionary, '%valid': { original: 'Opslaan', translation: 'Save' } }),
    };
    await new AutoTranslatorPostValidator(manager as unknown as TranslationManager).loopAndPromptValidateInvalidTranslations({ dryRun: true });
    const messages = log.mock.calls.map(([message]) => String(message));
    const summaries = messages.filter(message => message.includes('errors in auto translations'));
    expect(summaries).toHaveLength(count === 0 ? 0 : 1);
    if (count) {
        expect(summaries[0]).toContain(`Found ${count} errors`);
        expect(messages.some(message => message.includes(`${count}/${count}`))).toBe(true);
    }
});

it('rejects a failed locale build instead of continuing with stale output', async () => {
    await expect(TranslationManager.prototype.buildDist()).rejects.toThrow('build failed');
});

it('previews invalid translations without prompting or changing translation files', async () => {
    const manager = {
        iterateNonDefaultLocalesWithNamespaceAsync: async (callback: (locale: string, namespace: string) => Promise<void>) => await callback('en', 'stamhoofd'),
        readMachineTranslationDictionary: () => ({ '%test': { original: 'Account', translation: 'Account' } }),
        setSourceTranslation: vi.fn(),
        removeFromMachineTranslationDictionary: vi.fn(),
    };
    vi.mocked(promptYesNoOrDoubt).mockResolvedValue(YesNoOrDoubt.Yes);
    await new AutoTranslatorPostValidator(manager as unknown as TranslationManager).loopAndPromptValidateInvalidTranslations({ dryRun: true });
    expect(manager.setSourceTranslation).not.toHaveBeenCalled();
    expect(manager.removeFromMachineTranslationDictionary).not.toHaveBeenCalled();
    expect(promptYesNoOrDoubt).not.toHaveBeenCalled();
});
