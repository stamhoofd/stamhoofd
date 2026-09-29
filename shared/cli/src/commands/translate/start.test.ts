import { Parser } from '@oclif/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TranslateStart from './start.js';
import TranslateReplaceText from './replace-text.js';
import TranslateMachine from './machine.js';
import { createTranslationComparison, replaceKeysOnce, translateAutomatically, translateText } from '../../runtime/translation-tools.js';
import { translateMachine } from '../../runtime/translate.js';

const stages: string[] = [];
vi.mock('../../runtime/translation-tools.js', () => ({
    translateText: vi.fn(async () => { stages.push('text'); }),
    replaceKeysOnce: vi.fn(async () => { stages.push('keys'); }),
    translateAutomatically: vi.fn(async () => { stages.push('machine'); }),
    createTranslationComparison: vi.fn(async () => { stages.push('comparison'); }),
}));
vi.mock('../../runtime/translate.js', () => ({ translateMachine: vi.fn() }));

describe('translation tool commands', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        stages.length = 0;
    });

    it('passes oclif flags to the library and runs start in order', async () => {
        const command = new TranslateStart([], {} as never);
        (command as any).parse = vi.fn(async () => await Parser.parse([
            '--commits', 'HEAD~1', '--commits', 'HEAD', '-c', '--attribute-white-list', 'title',
            '--dry-run', '-p', '-f', '--fake', '--translator', 'Claude', '--locales', 'fr', '--locales', 'en',
        ], { flags: TranslateStart.flags }));

        await command.run();

        expect(stages).toEqual(['text', 'keys', 'machine', 'comparison']);
        expect(translateText).toHaveBeenCalledWith({
            commits: ['HEAD~1', 'HEAD'], changes: true, attributes: ['title'], dryRun: true, prompt: true, fix: true,
        });
        expect(translateAutomatically).toHaveBeenCalledWith({ fake: true, translatorType: 'Claude', locales: ['fr', 'en'] });
        expect(replaceKeysOnce).toHaveBeenCalledTimes(1);
        expect(createTranslationComparison).toHaveBeenCalledTimes(1);
    });

    it('accepts replace-text flags without running the other stages', async () => {
        const command = new TranslateReplaceText([], {} as never);
        (command as any).parse = vi.fn(async () => await Parser.parse(['--dry-run'], { flags: TranslateReplaceText.flags }));
        await command.run();

        expect(stages).toEqual(['text']);
        expect(translateText).toHaveBeenCalledWith(expect.objectContaining({ dryRun: true }));
    });

    it('passes machine flags through the standard machine stage', async () => {
        const command = new TranslateMachine([], {} as never);
        (command as any).parse = vi.fn(async () => await Parser.parse(['--fake', '--locales', 'fr'], { flags: TranslateMachine.flags }));
        await command.run();

        expect(translateMachine).toHaveBeenCalledWith({ fake: true, translatorType: undefined, locales: ['fr'] });
    });
});
