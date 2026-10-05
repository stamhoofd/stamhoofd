import { Parser } from '@oclif/core';
import { beforeEach, expect, it, vi } from 'vitest';
import Translate from './index.js';
import TranslateAuto from './auto.js';
import { showHelp } from '../../runtime/show-help.js';
import { translate } from '../../runtime/translate.js';
import { TranslatorType } from 'i18n-uuid/translator-type';

vi.mock('../../runtime/show-help.js', () => ({ showHelp: vi.fn() }));
vi.mock('../../runtime/translate.js', () => ({ translate: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

it('shows help rather than running translations without a subcommand', async () => {
    const config = {} as never;
    await new Translate([], config).run();
    expect(showHelp).toHaveBeenCalledWith(config, ['translate']);
    expect(translate).not.toHaveBeenCalled();
});

it('forwards locale, provider, and offline options to the pipeline', async () => {
    const command = new TranslateAuto([], {} as never);
    vi.spyOn(command, 'parse').mockResolvedValue(await Parser.parse([
        '--locale', 'fr', '--locale', 'en', '--provider', 'mistral-small', '--no-machine', '--fake',
    ], { flags: TranslateAuto.flags }) as never);
    await command.run();
    expect(translate).toHaveBeenCalledWith({
        machine: { translatorType: TranslatorType.MistralSmall, locales: ['fr', 'en'], fake: true },
        skipMachine: true,
    });
});
