import { config } from "dotenv";
import path from "node:path";
import { TranslatorType } from "../enums/TranslatorType";
import { DefaultLocalesDict } from "../types/DefaultLocalesDist";
import { EnvVariables } from "../types/EnvVariables";

config();

type Globals = EnvVariables & {
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
}

function getGlobals(): Globals {
    const envVariables: EnvVariables = readEnvVariables({
        GEMINI_API_KEY: '',
        OPENAI_API_KEY: '',
        MISTRAL_API_KEY: '',
    });

    const root = path.normalize(__dirname + "/../../../../.."); // (note we should build relative to the compiled output file in .development/i18n-uuid/dist/src/globals.js)

    const globals: Globals = {
        I18NUUID_ROOT: root,
        I18NUUID_LOCALES_ROOT: root + "/shared/locales",
        I18NUUID_LOCALES_DIR: root + "/shared/locales/src",
        I18NUUID_LOCALES_DIR_DIST: root + "/shared/locales/dist",
        COMPARE_OUTPUT_DIR: 'output',
        // This is the only environment variable we'll read for now, because the other once should always stay the same
        I18NUUID_EXCLUDE_DIRS_ARRAY: ["dist", "esm", "node_modules"],

        I18NUUID_DEFAULT_LOCALE: 'nl',
        DEFAULT_LOCALE: 'nl-BE',
        DEFAULT_COUNTRY: 'BE',
        DEFAULT_NAMESPACE: 'stamhoofd',
        DEFAULT_LOCALES: {
            es: {
                countries: {
                    CO: ["CO"],
                },
                default: "ES",
            },
            en: {
                default: "GB",
            },
            fr: {
                default: "BE",
            },
            nl: {
                default: "BE",
            },
        },
        TRANSLATOR: TranslatorType.OpenAi,
        ...envVariables

    };

    return globals;
}

function readEnvVariables(defaults: EnvVariables): EnvVariables {
    return Object.fromEntries(
        Object.entries(defaults).map(([key, defaultValue]) => {
            const value = (process.env as unknown as Partial<EnvVariables>)[key];
            return [key, value === undefined ? defaultValue : value];
    })) as EnvVariables;
}

export const globals: Globals = getGlobals();
