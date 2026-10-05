import { Parser } from '@oclif/core';
import { beforeEach, expect, it, vi } from 'vitest';
import Translate from './index.js';
import TranslateAuto from './auto.js';
import { showHelp } from '../../runtime/show-help.js';
import { translate, validateMachineTranslation } from '../../runtime/translate.js';
import { TranslatorType } from 'i18n-uuid/translator-type';

vi.mock('../../runtime/show-help.js', () => ({ showHelp: vi.fn() }));
vi.mock('../../runtime/translate.js', () => ({ translate: vi.fn(), validateMachineTranslation: vi.fn() }));
vi.mock('../../runtime/ux.js', () => ({ confirm: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() }));
vi.mock('../../context/project-path.js', () => ({ getProjectPath: () => '/repo' }));
vi.mock('../../runtime/vcs.js', () => ({ detectVcs: vi.fn(), Vcs: { Jj: 'jj' } }));
vi.mock('../../runtime/command-runner.js', () => ({ run: vi.fn(async () => ({ stdout: '' })), RunVerbosity: { Quiet: 0 } }));

beforeEach(() => vi.clearAllMocks());

it('shows help rather than running translations without a subcommand', async () => {
    const config = {} as never;
    await new Translate([], config).run();
    expect(showHelp).toHaveBeenCalledWith(config, ['translate']);
    expect(translate).not.toHaveBeenCalled();
});

it.each([false, true])('forwards locale and provider options (offline: %s)', async (offline) => {
    const command = new TranslateAuto([], {} as never);
    vi.mocked(validateMachineTranslation).mockResolvedValue(['fr', 'en']);
    vi.spyOn(command, 'parse').mockResolvedValue(await Parser.parse([
        '--locale', 'fr', '--locale', 'en', '--provider', 'mistral-small', '--fake', '--yes',
        ...(offline ? ['--no-machine'] : []),
    ], { flags: TranslateAuto.flags }) as never);
    await command.run();
    expect(translate).toHaveBeenCalledWith(expect.objectContaining({
        machine: { translatorType: TranslatorType.MistralSmall, locales: ['fr', 'en'], fake: true },
        skipMachine: offline ? true : undefined,
    }));
    expect(validateMachineTranslation).toHaveBeenCalledTimes(offline ? 0 : 1);
});

it('requires explicit approval before starting in a noninteractive terminal', async () => {
    const command = new TranslateAuto([], {} as never);
    vi.spyOn(command, 'parse').mockResolvedValue(await Parser.parse([], { flags: TranslateAuto.flags }) as never);
    await expect(command.run()).rejects.toThrow('pass --yes');
    expect(validateMachineTranslation).not.toHaveBeenCalled();
    expect(translate).not.toHaveBeenCalled();
});
