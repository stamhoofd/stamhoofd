import { Flags } from '@oclif/core';
import type { replaceText } from 'i18n-uuid/replace-text';
import type { autoTranslate } from 'i18n-uuid/auto-translate';
import { TranslatorType } from 'i18n-uuid/translator-type';

export const replaceTextFlags = {
    commits: Flags.string({ description: 'Git commits to compare', multiple: true }),
    changes: Flags.boolean({ char: 'c', description: 'Only check changed files' }),
    'attribute-white-list': Flags.string({ description: 'HTML attributes to allow', multiple: true }),
    'dry-run': Flags.boolean({ description: 'Do not write translated files' }),
    prompt: Flags.boolean({ char: 'p', description: 'Prompt before each replacement' }),
    fix: Flags.boolean({ char: 'f', description: 'Fix changed files with ESLint' }),
};

export const machineFlags = {
    fake: Flags.boolean({ description: 'Use fake translations for testing' }),
    translator: Flags.string({ description: 'Translation provider', options: Object.values(TranslatorType) }),
    locales: Flags.string({ description: 'Locales to translate', multiple: true }),
};

type TranslationFlags = {
    commits?: string[];
    changes?: boolean;
    'attribute-white-list'?: string[];
    'dry-run'?: boolean;
    prompt?: boolean;
    fix?: boolean;
    fake?: boolean;
    translator?: string;
    locales?: string[];
};

export function replaceTextArgs(flags: TranslationFlags): Parameters<typeof replaceText>[0] {
    return {
        commits: flags.commits,
        changes: flags.changes,
        attributes: flags['attribute-white-list'],
        dryRun: flags['dry-run'],
        prompt: flags.prompt,
        fix: flags.fix,
    };
}

export function machineArgs(flags: TranslationFlags): Parameters<typeof autoTranslate>[0] {
    return {
        fake: flags.fake,
        translatorType: flags.translator as TranslatorType | undefined,
        locales: flags.locales,
    };
}
