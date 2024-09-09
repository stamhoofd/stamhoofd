import fs from "fs";
import path from "path";
import { readTranslations } from "./read-translations";

export function getTranslationsWithPath(): Map<string, Record<string, string>> {
    // Path to the directory containing your translation files (e.g., locales/en.json)
    const localesDir = "../../shared/locales/src";

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
    const defaultLocale = 'nl';
    const filePath = `../../shared/locales/src/${defaultLocale}.json`;
    const translations = readTranslations(filePath);
    return {translations, filePath};
}
