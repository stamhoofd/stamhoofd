import { config } from "dotenv";
import path from "node:path";
import { isLocale } from "./helpers/i18n-helpers";

config();

type EnvVariables = {
    // Path to the directory containing your files that should be checked for translation keys
    readonly I18NUUID_ROOT: string;
    readonly I18NUUID_LOCALES_ROOT: string;
    // Path to the directory containing your translation files (e.g., locales/en.json)
    readonly I18NUUID_LOCALES_DIR: string;
    // Path to the directory containing your built translations
    readonly I18NUUID_LOCALES_DIR_DIST: string;
    readonly DEFAULT_LOCALE: string;
    readonly DEFAULT_COUNTRY: string;
    readonly DEFAULT_NAMESPACE: string;
    // Directories that should be ignored
    readonly I18NUUID_EXCLUDE_DIRS_ARRAY: string[];
    readonly GEMINI_API_KEY: string;
    readonly DEFAULT_LOCALES: DefaultLocalesDict;
};

type DefaultLocalesDict = Record<
    string,
    { countries?: Record<string, string[]>; default: string }
>;

function getVariables(): EnvVariables {
    const root = path.normalize(__dirname + "/../../../.."); // (note we should build relative to the compiled output file in .development/i18n-uuid/dist/src/globals.js)
    const emptyVariables: EnvVariables = {
        I18NUUID_ROOT: root,
        I18NUUID_LOCALES_ROOT: root + "/shared/locales",
        I18NUUID_LOCALES_DIR: root + "/shared/locales/src",
        I18NUUID_LOCALES_DIR_DIST: root + "/shared/locales/dist",
        DEFAULT_LOCALE: process.env.DEFAULT_LOCALE ?? "nl-BE",
        DEFAULT_COUNTRY: process.env.DEFAULT_COUNTRY ?? "BE",
        DEFAULT_NAMESPACE: process.env.DEFAULT_NAMESPACE ?? "stamhoofd",
        // This is the only environment variable we'll read for now, because the other once should always stay the same
        I18NUUID_EXCLUDE_DIRS_ARRAY: ["dist", "esm", "node_modules"],
        GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? "",
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
            nl: {
                default: "BE",
            },
        },
    };

    if (!isLocale(emptyVariables.DEFAULT_LOCALE)) {
        throw new Error(
            `Default locale ${emptyVariables.DEFAULT_LOCALE} should be a valid locale`,
        );
    }

    return emptyVariables;
}

export const globals: EnvVariables = getVariables();
