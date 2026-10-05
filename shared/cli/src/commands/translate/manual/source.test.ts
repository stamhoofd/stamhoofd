import { Parser } from '@oclif/core';
import { expect, it, vi } from 'vitest';
import TranslateSource from './source.js';
import { replaceText } from 'i18n-uuid/replace-text';

vi.mock('i18n-uuid/replace-text', () => ({ replaceText: vi.fn() }));
vi.mock('../../../runtime/translate.js', () => ({ inTranslationDirectory: async (action: () => Promise<void>) => await action() }));

it('forwards source options and makes previews noninteractive', async () => {
    const command = new TranslateSource([], {} as never);
    vi.spyOn(command, 'parse').mockResolvedValue(await Parser.parse([
        '--commits', 'HEAD~1', '--commits', 'HEAD', '--attribute-white-list', 'title', '--dry-run', '--prompt', '--fix',
    ], { flags: TranslateSource.flags }) as never);
    await command.run();
    expect(replaceText).toHaveBeenCalledWith({
        changes: true, commits: ['HEAD~1', 'HEAD'], attributes: ['title'], dryRun: true, prompt: false, fix: true,
    });
});
