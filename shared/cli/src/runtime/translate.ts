import { getProjectPath } from '../context/project-path.js';
import { run, RunVerbosity } from './command-runner.js';
import { autoTranslate } from 'i18n-uuid/auto-translate';
import { TranslatorType } from 'i18n-uuid/translator-type';
import { replaceKeys } from 'i18n-uuid/replace-keys';
import { mergeDuplicates } from 'i18n-uuid/merge-duplicates';
import { unusedKeys } from 'i18n-uuid/unused-keys';
import { globals } from 'i18n-uuid/globals';
import { TranslationManager } from 'i18n-uuid/translation-manager';
import { resolveTranslationApiKey } from './translation-credentials.js';

export async function translateKeys(): Promise<void> {
    replaceKeys();
    replaceKeys();
}

export async function translateCompress(): Promise<void> {
    await run('pnpm', ['--dir', 'shared/locales', 'run', 'build'], { cwd: getProjectPath(), verbosity: RunVerbosity.Output });
    mergeDuplicates();
    unusedKeys();
}

export async function translateMachine(options: Parameters<typeof autoTranslate>[0] = {}): Promise<void> {
    const { apiKey } = await prepareMachineTranslation(options);
    await run('pnpm', ['--dir', 'shared/locales', 'run', 'build'], { cwd: getProjectPath(), verbosity: RunVerbosity.Output });
    await autoTranslate({ ...options, apiKey });
}

export type TranslationStage = 'keys' | 'cleanup' | 'machine';

export async function validateMachineTranslation(options: Parameters<typeof autoTranslate>[0] = {}): Promise<string[]> {
    return (await prepareMachineTranslation(options)).locales;
}

async function prepareMachineTranslation(options: Parameters<typeof autoTranslate>[0]) {
    const manager = new TranslationManager();
    const available = manager.locales.filter(locale => manager.getMappedLocale(locale) !== globals.DEFAULT_LOCALE && locale !== globals.DEFAULT_LOCALE);
    const locales = options.locales ?? available;
    for (const locale of locales) {
        if (!available.includes(locale)) {
            throw new Error(`Locale "${locale}" is not a configured non-Dutch locale. Choose from: ${available.join(', ')}.`);
        }
    }
    if (!locales.length) {
        throw new Error('No non-Dutch locales are configured for machine translation.');
    }
    const provider = options.translatorType ?? globals.TRANSLATOR;
    if (provider === TranslatorType.Claude) {
        throw new Error('The Claude translator is not implemented. Choose another provider.');
    }
    const apiKey = options.fake ? undefined : await resolveTranslationApiKey(provider);
    return { locales, apiKey };
}

export async function translate(options: { machine?: Parameters<typeof autoTranslate>[0]; skipMachine?: boolean; onStage?: (stage: TranslationStage) => void } = {}): Promise<void> {
    if (!options.skipMachine) {
        await validateMachineTranslation(options.machine);
    }
    options.onStage?.('keys');
    await translateKeys();
    options.onStage?.('cleanup');
    await translateCompress();
    if (!options.skipMachine) {
        options.onStage?.('machine');
        await translateMachine(options.machine);
    }
}
