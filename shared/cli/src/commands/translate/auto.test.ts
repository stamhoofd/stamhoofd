import { Parser } from '@oclif/core';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Translate from './index.js';
import TranslateAuto from './auto.js';
import { showHelp } from '../../runtime/show-help.js';
import { translate, validateMachineTranslation } from '../../runtime/translate.js';
import { TranslatorType } from 'i18n-uuid/translator-type';
import { confirm, info } from '../../runtime/ux.js';

vi.mock('../../runtime/show-help.js', () => ({ showHelp: vi.fn() }));
vi.mock('../../runtime/translate.js', () => ({ translate: vi.fn(), validateMachineTranslation: vi.fn() }));
vi.mock('../../runtime/ux.js', () => ({ confirm: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() }));
vi.mock('../../context/project-path.js', () => ({ getProjectPath: () => '/repo' }));
vi.mock('../../runtime/vcs.js', () => ({ detectVcs: vi.fn(), Vcs: { Jj: 'jj' } }));
vi.mock('../../runtime/command-runner.js', () => ({ run: vi.fn(async () => ({ stdout: '' })), RunVerbosity: { Quiet: 0 } }));

const stdinTTY = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY');
const stdoutTTY = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(confirm).mockReset();
    Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: false });
    Object.defineProperty(process.stdout, 'isTTY', { configurable: true, value: false });
});

afterEach(() => {
    for (const [stream, descriptor] of [[process.stdin, stdinTTY], [process.stdout, stdoutTTY]] as const) {
        if (descriptor) {
            Object.defineProperty(stream, 'isTTY', descriptor);
        }
        else {
            Reflect.deleteProperty(stream, 'isTTY');
        }
    }
});

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
    expect(confirm).not.toHaveBeenCalled();
});

it.each([false, true])('lets interactive users choose machine translation before credential lookup (machine: %s)', async (machine) => {
    Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: true });
    Object.defineProperty(process.stdout, 'isTTY', { configurable: true, value: true });
    const command = new TranslateAuto([], {} as never);
    vi.spyOn(command, 'parse' as never).mockResolvedValue(await Parser.parse([], { flags: TranslateAuto.flags }) as never);
    vi.mocked(confirm).mockResolvedValueOnce(machine).mockResolvedValueOnce(true);
    vi.mocked(validateMachineTranslation).mockResolvedValue(['fr']);

    await command.run();

    expect(confirm).toHaveBeenNthCalledWith(1, 'Perform AI machine translation as well?');
    expect(confirm).toHaveBeenNthCalledWith(2, 'Prepare translations for release?');
    expect(info).toHaveBeenCalledWith('For API keys from 1Password, unlock the "DevOps Development" vault before continuing.');
    expect(validateMachineTranslation).toHaveBeenCalledTimes(machine ? 1 : 0);
    if (machine) {
        expect(confirm).toHaveBeenCalledBefore(validateMachineTranslation);
        expect(info).toHaveBeenCalledBefore(validateMachineTranslation);
    }
    expect(translate).toHaveBeenCalledWith(expect.objectContaining({ skipMachine: !machine }));
});

it('respects --no-machine without asking about AI or looking up credentials', async () => {
    Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: true });
    Object.defineProperty(process.stdout, 'isTTY', { configurable: true, value: true });
    const command = new TranslateAuto([], {} as never);
    vi.spyOn(command, 'parse' as never).mockResolvedValue(await Parser.parse(['--no-machine'], { flags: TranslateAuto.flags }) as never);
    vi.mocked(confirm).mockResolvedValue(true);

    await command.run();

    expect(confirm).toHaveBeenCalledExactlyOnceWith('Prepare translations for release?');
    expect(validateMachineTranslation).not.toHaveBeenCalled();
    expect(translate).toHaveBeenCalledWith(expect.objectContaining({ skipMachine: true }));
});

it('labels fake translation explicitly and still respects the final cancellation', async () => {
    Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: true });
    Object.defineProperty(process.stdout, 'isTTY', { configurable: true, value: true });
    const command = new TranslateAuto([], {} as never);
    vi.spyOn(command, 'parse' as never).mockResolvedValue(await Parser.parse(['--fake'], { flags: TranslateAuto.flags }) as never);
    vi.mocked(confirm).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    vi.mocked(validateMachineTranslation).mockResolvedValue(['fr']);

    await command.run();

    expect(confirm).toHaveBeenNthCalledWith(1, 'Generate fake machine translations as well?');
    expect(info).not.toHaveBeenCalledWith(expect.stringContaining('1Password'));
    expect(translate).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith('Cancelled. No translation files were changed.');
});

it('requires explicit approval before starting in a noninteractive terminal', async () => {
    const command = new TranslateAuto([], {} as never);
    vi.spyOn(command, 'parse').mockResolvedValue(await Parser.parse([], { flags: TranslateAuto.flags }) as never);
    await expect(command.run()).rejects.toThrow('pass --yes');
    expect(validateMachineTranslation).not.toHaveBeenCalled();
    expect(translate).not.toHaveBeenCalled();
});
