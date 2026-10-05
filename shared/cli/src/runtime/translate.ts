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
import { translationStep } from './translation-progress.js';
import { step } from './ux.js';

export async function translateKeys(): Promise<void> {
    await translationStep('Register translation keys', async (onProgress) => {
        const added = await replaceKeys(onProgress);
        return added + await replaceKeys(onProgress);
    }, added => `Registered ${added} new translation keys`);
}

export async function translateCompress(): Promise<void> {
    await buildTranslationLocales();
    await translationStep('Merge duplicate translations', mergeDuplicates, count => `Merged ${count} duplicate keys`);
    await translationStep('Remove unused translation keys', unusedKeys, count => `Removed ${count} unused translation entries`);
}

export async function translateMachine(options: Parameters<typeof autoTranslate>[0] = {}): Promise<void> {
    const { apiKey } = await prepareMachineTranslation(options);
    await buildTranslationLocales();
    await translationStep(options.fake ? 'Generate fake translations' : 'Machine translation', async onProgress => await autoTranslate({ ...options, apiKey, onProgress }));
}

async function buildTranslationLocales() {
    await step('Build translation locales', async () => {
        const result = await run('pnpm', ['--dir', 'shared/locales', 'run', 'build'], { cwd: getProjectPath(), verbosity: RunVerbosity.Quiet, capture: true, allowFailure: true });
        if (result.status !== 0) {
            throw new Error(`Locale build failed:\n${result.stdout}\n${result.stderr}`);
        }
    });
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
