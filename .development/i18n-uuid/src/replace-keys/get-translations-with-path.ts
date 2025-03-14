import fs from "fs";
import path from "path";
import { globals } from "../shared/globals";
import { readTranslations } from "./read-translations";

export function getTranslationsWithPath(): Map<string, Record<string, string>> {
    // Path to the directory containing your translation files (e.g., locales/en.json)
    const localesDir = globals.I18NUUID_LOCALES_DIR;

    const result = new Map();

    const filePaths: string[] = [];

    const addTranslationFilePaths = (dir: string) => {
        const files = fs.readdirSync(dir);

        for (const file of files) {
            const filePath = path.join(dir, file);

            const stats = fs.statSync(filePath);

            if (stats.isFile()) {
                if (filePath.endsWith(".json")) {
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

    for (const filePath of filePaths) {
        const translations = readTranslations(filePath);
        result.set(filePath, translations);
    }

    return result;
}

export function getDefaultTranslations(): {translations: Record<string, string>, filePath: string} {
    const defaultLocale = globals.I18NUUID_DEFAULT_LOCALE;
    const filePath = `${globals.I18NUUID_LOCALES_DIR}/${defaultLocale}.json`;
    const translations = readTranslations(filePath);
    return {translations, filePath};
}
