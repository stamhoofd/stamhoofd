import fs from 'fs';
import path from 'path';
import { globals } from '../shared/globals.js';
import { readTranslations } from './read-translations.js';

export function getTranslationsWithPath(): Map<string, Map<string, unknown>> {
    // Path to the directory containing your translation files (e.g., locales/en.json)
    const localesDir = globals.I18NUUID_LOCALES_DIR;

    const result = new Map<string, Map<string, unknown>>();

    const filePaths: string[] = [];

    const addTranslationFilePaths = (dir: string) => {
        const files = fs.readdirSync(dir);

        for (const file of files) {
            const filePath = path.join(dir, file);

            const stats = fs.statSync(filePath);

            if (stats.isFile()) {
                if (filePath.endsWith('.json')) {
                    filePaths.push(filePath);
                }

                continue;
            }

            if (stats.isDirectory()) {
                addTranslationFilePaths(filePath);
            }
        }
    };

    addTranslationFilePaths(localesDir);

    for (const filePath of filePaths.filter(path => !path.includes('consistent-words'))) {
        const translations = readTranslations(filePath);
        result.set(filePath, translations);
    }

    return result;
}

export function getDefaultTranslations(): { translations: Map<string, unknown>; filePath: string } {
    const defaultLocale = globals.I18NUUID_DEFAULT_LOCALE;
    const filePath = `${globals.I18NUUID_LOCALES_DIR}/${defaultLocale}.json`;
    const translations = readTranslations(filePath);
    return { translations, filePath };
}
