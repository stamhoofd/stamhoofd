import { config } from "dotenv";
import path from "node:path";
import { TranslatorType } from "../enums/TranslatorType";
import { isLanguage, isLocale } from "../helpers/i18n-helpers";
import { isTranslatorType } from "../helpers/validate-translator-type";
import { DefaultLocalesDict } from "../types/DefaultLocalesDist";
import { EnvVariables } from "../types/EnvVariables";

config();

function getVariables(): EnvVariables {
    const root = path.normalize(__dirname + "/../../../.."); // (note we should build relative to the compiled output file in .development/i18n-uuid/dist/src/globals.js)

    const emptyVariables: EnvVariables = {
        I18NUUID_ROOT: getEnvVariableOrDefault('I18NUUID_ROOT', root),
        I18NUUID_LOCALES_ROOT: getEnvVariableOrDefault('I18NUUID_LOCALES_ROOT', root + "/shared/locales"),
        I18NUUID_LOCALES_DIR: getEnvVariableOrDefault('I18NUUID_LOCALES_DIR', root + "/shared/locales/src"),
        I18NUUID_LOCALES_DIR_DIST: getEnvVariableOrDefault('I18NUUID_LOCALES_DIR_DIST', root + "/shared/locales/dist"),
        COMPARE_OUTPUT_DIR: getEnvVariableOrDefault('COMPARE_OUTPUT_DIR', ''),
        // This is the only environment variable we'll read for now, because the other once should always stay the same
        I18NUUID_EXCLUDE_DIRS_ARRAY: getDirectoriesToExclude(),

        I18NUUID_DEFAULT_LOCALE: getEnvVariableOrDefault('I18NUUID_DEFAULT_LOCALE', 'nl'),
        DEFAULT_LOCALE: getDefaultLocale(),
        DEFAULT_COUNTRY: getEnvVariableOrDefault('DEFAULT_COUNTRY', 'BE'),
        DEFAULT_NAMESPACE: getEnvVariableOrDefault('DEFAULT_NAMESPACE', 'stamhoofd'),
        DEFAULT_LOCALES: getDefaultLocales(),
        TRANSLATOR: getTranslatorType(),

        // API Keys
        GEMINI_API_KEY: getEnvVariableOrDefault('GEMINI_API_KEY', ''),
        OPENAI_API_KEY: getEnvVariableOrDefault('OPENAI_API_KEY', ''),
        MISTRAL_API_KEY: getEnvVariableOrDefault('MISTRAL_API_KEY', ''),
    };

    return emptyVariables;
}

function getEnvVariableOrDefault<KEY extends keyof EnvVariables>(key: KEY, defaultValue: EnvVariables[KEY]): EnvVariables[KEY] {
    const value = (process.env as unknown as Partial<EnvVariables>)[key];
    if(value === undefined) {
        return defaultValue;
    }
    return value;
}

function getDirectoriesToExclude(): string[] {
    const envVar = process.env.I18NUUID_EXCLUDE_DIRS_ARRAY;
    if (envVar) {
        return envVar.split(",");
    }

    return ["dist", "esm", "node_modules"];
}

function getDefaultLocale() {
    const defaultLocale = getEnvVariableOrDefault('DEFAULT_LOCALE', 'nl-BE');

    if (!isLocale(defaultLocale)) {
        throw new Error(
            `Default locale ${defaultLocale} should be a valid locale`,
        );
    }

    return defaultLocale;
}

function getDefaultLocales(): DefaultLocalesDict {
    const json = process.env.DEFAULT_LOCALES;

    if (!json) {
        return {
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
        };
    }

    const parsed = JSON.parse(json);

    // validate settings
    for (const [language, settings] of Object.entries(parsed)) {
        if (!isLanguage(language)) {
            throw new Error(
                "keys on default locales object can only be languages",
            );
        }
        const defaultCountry = settings?.["default"];
        if (defaultCountry === undefined) {
            throw new Error(`no default country set for language ${language}`);
        }

        const countries = settings?.["countries"];

        if (countries) {
            if (typeof countries !== "object" || Array.isArray(countries)) {
                throw new Error(
                    `countries should be a record of country keys and array of countries values for ${language}`,
                );
            }

            for (const value of Object.values(countries)) {
                if (
                    !Array.isArray(value) ||
                    value.some((country) => typeof country !== "string")
                ) {
                    throw new Error(
                        `countries should be an array of string countries for ${language}`,
                    );
                }
            }
        }
    }

    return parsed;
}

function getTranslatorType(): TranslatorType {
    const translator = getEnvVariableOrDefault('TRANSLATOR', TranslatorType.GoogleGemini);

    if (!isTranslatorType(translator)) {
        throw new Error("Unknown translator type: " + translator);
    }

    return translator;
}

export const globals: EnvVariables = getVariables();
