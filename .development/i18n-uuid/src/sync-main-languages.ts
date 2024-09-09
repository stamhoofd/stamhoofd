import fs from "fs";
import path from "path";
import { readTranslations } from "./read-translations";
import { writeTranslation } from "./write-translations";

const defaultLocale = "nl";
const otherMainLocales = ["en"];
const localesDir = "../../shared/locales/src";

export function syncMainLanguages() {
    syncMainLanguageInDirectory(localesDir);
}

function syncMainLanguageInDirectory(dir: string) {
    const files = fs.readdirSync(dir);

    // filePath, translations
    let mainTranslations: Record<string, string> | undefined;
    const otherTranslations = new Map<string, Record<string, string>>();

    for (const file of files) {
        const filePath = path.join(dir, file);

        const stats = fs.statSync(filePath);

        if (stats.isFile()) {
            if (filePath.endsWith(`${defaultLocale}.json`)) {
                mainTranslations = readTranslations(filePath);
                continue;
            }

            for (const otherMainLocale of otherMainLocales) {
                if (filePath.endsWith(`${otherMainLocale}.json`)) {
                    otherTranslations.set(filePath, readTranslations(filePath));
                }
            }

            continue;
        }

        if (stats.isDirectory()) {
            syncMainLanguageInDirectory(filePath);
        }
    }

    if (otherTranslations.size > 0 && !mainTranslations) {
        if (!mainTranslations) {
            console.warn("No default translations found in directory: " + dir);
        } else {
            for (const [filePath, translations] of otherTranslations) {
                let hasChanged = false;

                for (const [key, value] of Object.entries<string>(
                    mainTranslations,
                )) {
                    console.log(key);
                    if (!translations[key]) {
                        translations[key] = value;
                        hasChanged = true;
                    }
                }

                if (hasChanged) {
                    writeTranslation(filePath, translations);
                }
            }
        }
    }
}
