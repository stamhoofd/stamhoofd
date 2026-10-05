import path from 'node:path';
import { getProjectPath } from '../context/project-path.js';
import { run, RunVerbosity } from './command-runner.js';
import type { autoTranslate } from 'i18n-uuid/auto-translate';
import { TranslatorType } from 'i18n-uuid/translator-type';

export async function inTranslationDirectory<T>(action: () => T | Promise<T>): Promise<T> {
    const previousDirectory = process.cwd();
    process.chdir(path.join(getProjectPath(), '.development/i18n-uuid'));
    try {
        return await action();
    }
    finally {
        process.chdir(previousDirectory);
    }
}

export async function translateKeys(): Promise<void> {
    await inTranslationDirectory(async () => {
        const { replaceKeys } = await import('i18n-uuid/replace-keys');
        replaceKeys();
        replaceKeys();
    });
}

export async function translateCompress(): Promise<void> {
    await run('pnpm', ['--dir', 'shared/locales', 'run', 'build'], { cwd: getProjectPath(), verbosity: RunVerbosity.Output });
    await inTranslationDirectory(async () => {
        const { mergeDuplicates } = await import('i18n-uuid/merge-duplicates');
        const { unusedKeys } = await import('i18n-uuid/unused-keys');
        mergeDuplicates();
        unusedKeys();
    });
}

export async function translateMachine(options: Parameters<typeof autoTranslate>[0] = {}): Promise<void> {
    await validateMachineTranslation(options);
    await run('pnpm', ['--dir', 'shared/locales', 'run', 'build'], { cwd: getProjectPath(), verbosity: RunVerbosity.Output });
    await inTranslationDirectory(async () => {
        const { autoTranslate } = await import('i18n-uuid/auto-translate');
        await autoTranslate(options);
    });
}

export type TranslationStage = 'keys' | 'cleanup' | 'machine';

export async function validateMachineTranslation(options: Parameters<typeof autoTranslate>[0] = {}): Promise<string[]> {
    return await inTranslationDirectory(async () => {
        const { globals } = await import('i18n-uuid/globals');
        const { TranslationManager } = await import('i18n-uuid/translation-manager');
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
        const credentials = {
            [TranslatorType.OpenAi]: ['OPENAI_API_KEY', globals.OPENAI_API_KEY],
            [TranslatorType.GoogleGemini]: ['GEMINI_API_KEY', globals.GEMINI_API_KEY],
            [TranslatorType.MistralLarge]: ['MISTRAL_API_KEY', globals.MISTRAL_API_KEY],
            [TranslatorType.MistralSmall]: ['MISTRAL_API_KEY', globals.MISTRAL_API_KEY],
        };
        if (provider === TranslatorType.Claude) {
            throw new Error('The Claude translator is not implemented. Choose another provider.');
        }
        const [variable, value] = credentials[provider];
        if (!value.trim()) {
            throw new Error(`Set ${variable} in .development/i18n-uuid/.env or your environment before translating with ${provider}. Use --no-machine with translate auto to prepare keys without AI.`);
        }
        return locales;
    });
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
