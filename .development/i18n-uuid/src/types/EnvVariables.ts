import { TranslatorType } from "../enums/TranslatorType";
import { DefaultLocalesDict } from "./DefaultLocalesDist";

export type EnvVariables = {
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

    // API Keys
    readonly GEMINI_API_KEY: string;
    readonly OPENAI_API_KEY: string;
    readonly MISTRAL_API_KEY: string;
};
