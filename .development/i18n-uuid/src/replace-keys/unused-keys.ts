import { getTranslationsWithPath } from "./get-translations-with-path";
import { findUnusedTranslationKeys } from "./replace-keys-with-uuid";
import { writeTranslation } from "./write-translations";

export function unusedKeys() {
    const translationsWithPath = getTranslationsWithPath();
    for (const [filePath, translations] of translationsWithPath) {
        const keys = new Set<string>();

        for (const key in translations) {
            if (key === 'replacements' || key === 'extends' || key === 'consistent-words') {
                continue;
            }
            if (typeof translations[key] === 'string') {
                keys.add(key)
            }
        }

        const unusedKeys = findUnusedTranslationKeys(keys);

        if (unusedKeys.size) {
            for (const key of unusedKeys.values()) {
                console.log('Found unused key ' + key + ' in ' + filePath)

                delete translations[key];
            }

            writeTranslation(filePath, translations);
        }
    }
}
