import { expect, it, vi } from 'vitest';
import { AutoTranslatorPostValidator } from './AutoTranslatorPostValidator.js';
import { TranslationManager } from './TranslationManager.js';
import { promptYesNoOrDoubt, YesNoOrDoubt } from '../shared/prompt-helper.js';

vi.mock('child_process', async original => ({ ...await original<typeof import('child_process')>(), exec: vi.fn((_command: string, callback: (error: Error) => void) => {
    callback(new Error('build failed'));
    return {};
}) }));
vi.mock('../shared/prompt-helper.js', async original => ({ ...await original<typeof import('../shared/prompt-helper.js')>(), promptYesNoOrDoubt: vi.fn() }));

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
