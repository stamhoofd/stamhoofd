import fs from "fs";
import path from "path";
import { globals } from "./globals";
import { readTranslations } from "./read-translations";
import { writeTranslation } from "./write-translations";

export function syncMainLocales() {
    console.log("Start sync main locales.");
    const hasChanged = syncMainLocalesInDirectory(globals.I18NUUID_LOCALES_DIR);
    if (!hasChanged) {
        console.log("Main locales already up to date.");
    }
    console.log("Finished sync main locales.");
}

function syncMainLocalesInDirectory(dir: string): boolean {
    let hasChanged = false;
    const files = fs.readdirSync(dir);
    const defaultLocale = globals.I18NUUID_DEFAULT_LOCALE;
    const otherMainLocales = globals.I18NUUID_OTHER_MAIN_LOCALES_ARRAY;

    // filePath, translations
    let mainTranslations: Record<string, string> | undefined;
    const otherTranslations = new Map<string, Record<string, string>>();

    for (const file of files) {
        const filePath = path.join(dir, file);

        const stats = fs.statSync(filePath);

        if (stats.isFile()) {
            if (file === `${defaultLocale}.json`) {
                mainTranslations = readTranslations(filePath);
                continue;
            }

            for (const otherMainLocale of otherMainLocales) {
                if (file === `${otherMainLocale}.json`) {
                    otherTranslations.set(filePath, readTranslations(filePath));
                    break;
                }
            }

            continue;
        }

        if (stats.isDirectory()) {
            const hasChildDirectoryChanged =
                syncMainLocalesInDirectory(filePath);
            if (hasChildDirectoryChanged) {
                hasChanged = true;
            }
        }
    }

    if (otherTranslations.size > 0) {
        if (!mainTranslations) {
            console.warn("No default translations found in directory: " + dir);
        } else {
            for (const [filePath, translations] of otherTranslations) {
                let keysAdded = 0;

                for (const [key, value] of Object.entries<string>(
                    mainTranslations,
                )) {
                    if (!translations[key]) {
                        translations[key] = value;
                        keysAdded++;
                    }
                }

                if (keysAdded > 0) {
                    console.log(
                        `Sync main locales: added ${keysAdded} key(s) to ${filePath}.`,
                    );
                    writeTranslation(filePath, translations);
                    if (!hasChanged) {
                        hasChanged = true;
                    }
                }
            }
        }
    }

    return hasChanged;
}
