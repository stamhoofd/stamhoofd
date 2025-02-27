import { config } from 'dotenv';
import path from 'node:path';

config()

type EnvVariables = {
    // Path to the directory containing your files that should be checked for translation keys
    readonly I18NUUID_ROOT: string;
    // Path to the directory containing your translation files (e.g., locales/en.json)
    readonly I18NUUID_LOCALES_DIR: string;
    // Path to the directory containing your built translations
    readonly I18NUUID_LOCALES_DIR_DIST: string;
    // The locale where the translations that are replaced will be stored into
    readonly I18NUUID_DEFAULT_LOCALE: string;
    // Directories that should be ignored
    readonly I18NUUID_EXCLUDE_DIRS_ARRAY: string[];
    
}

function getVariables(): EnvVariables {
    const root = path.normalize(__dirname + '/../../../..'); // (note we should build relative to the compiled output file in .development/i18n-uuid/dist/src/globals.js)
    const emptyVariables: EnvVariables = {
        I18NUUID_ROOT: root,
        I18NUUID_LOCALES_DIR: root + '/shared/locales/src',
        I18NUUID_LOCALES_DIR_DIST: root + '/shared/locales/dist',
        I18NUUID_DEFAULT_LOCALE: process.env.I18NUUID_DEFAULT_LOCALE ?? 'nl',  // This is the only environment variable we'll read for now, because the other once should always stay the same
        I18NUUID_EXCLUDE_DIRS_ARRAY: ['dist', 'esm', 'node_modules']
    };

    return emptyVariables;
}


export const globals: EnvVariables = getVariables();
