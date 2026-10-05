import path from 'node:path';
import { TranslatorType } from '../enums/TranslatorType.js';
import type { DefaultLocalesDict } from '../types/DefaultLocalesDist.js';
type Globals = {
    // Path to the directory containing your files that should be checked for translation keys
    readonly I18NUUID_ROOT: string;
    readonly I18NUUID_LOCALES_ROOT: string;
    // Path to the directory containing your translation files (e.g., locales/en.json)
    readonly I18NUUID_LOCALES_DIR: string;
    // Path to the directory containing your built translations
    readonly I18NUUID_LOCALES_DIR_DIST: string;
    readonly COMPARE_OUTPUT_DIR: string;
    // Directories that should be ignored
    readonly I18NUUID_EXCLUDE_DIRS_ARRAY: string[];

    // The locale where the translations that are replaced will be stored into
    readonly I18NUUID_DEFAULT_LOCALE: string;
    readonly DEFAULT_LOCALE: string;
    readonly DEFAULT_COUNTRY: string;
    readonly DEFAULT_NAMESPACE: string;
    readonly DEFAULT_LOCALES: DefaultLocalesDict;
    readonly TRANSLATOR: TranslatorType;
};

function getGlobals(): Globals {
    const root = path.normalize(import.meta.dirname + '/../../../..');

    const globals: Globals = {
        I18NUUID_ROOT: root,
        I18NUUID_LOCALES_ROOT: root + '/shared/locales',
        I18NUUID_LOCALES_DIR: root + '/shared/locales/src',
        I18NUUID_LOCALES_DIR_DIST: root + '/shared/locales/dist/locales',
        COMPARE_OUTPUT_DIR: path.join(root, '.development/i18n-uuid/output'),
        I18NUUID_EXCLUDE_DIRS_ARRAY: ['dist', 'esm', 'node_modules'],

        I18NUUID_DEFAULT_LOCALE: 'nl',
        DEFAULT_LOCALE: 'nl-BE',
        DEFAULT_COUNTRY: 'BE',
        DEFAULT_NAMESPACE: 'stamhoofd',
        DEFAULT_LOCALES: {
            es: {
                countries: {
                    CO: ['CO'],
                },
                default: 'ES',
            },
            en: {
                default: 'GB',
            },
            fr: {
                default: 'BE',
            },
            nl: {
                default: 'BE',
            },
        },
        TRANSLATOR: TranslatorType.OpenAi,

    };

    return globals;
}

export const globals: Globals = getGlobals();
