import { getTranslationsWithPath } from './get-translations-with-path.js';
import { findUnusedTranslationKeys, replaceOccurrences } from './replace-keys-with-uuid.js';
import { writeTranslation } from './write-translations.js';

/**
 * Find translations that have the same translation for every language (machine translations are ignored because those are automatically generated and should resolve to the same value), and merge them.
 */
export function mergeDuplicates() {
    const translationsWithPath = getTranslationsWithPath();

    /**
     * Map that for every translation key found, keeps track of the value in each translation file.
     * {
     *   "uuid": {
     *    "nl.json": "Voorbeeld",
     *    "en.json": "Example"
     *   }
     *   ...
     * }
     */
    const translationsForKeys = new Map<string, Map<string, string>>();

    // Build map
    for (const [filePath, translations] of translationsWithPath) {
        for (const key in translations) {
            if (key === 'replacements' || key === 'extends' || key === 'consistent-words') {
                continue;
            }
            if (typeof translations[key] === 'string') {
                const existingMap = translationsForKeys.get(key);
                if (existingMap) {
                    existingMap.set(filePath, translations[key]);
                }
                else {
                    translationsForKeys.set(key, new Map([[
                        filePath, translations[key],
                    ]]));
                }
            }
        }
    }

    // Find uuids in translationsForKeys with the exact same content (so same map keys and values, same size)
    const merge: Map<string, string> = new Map();
    for (const [uuid, values] of translationsForKeys.entries()) {
        for (const [otherUuid, otherValues] of translationsForKeys.entries()) {
            if (otherUuid === uuid) {
                continue;
            }
            if (otherUuid < uuid) {
                // Already checked in the other direction
                continue;
            }

            if (isMapEqual(values, otherValues)) {
                console.log('Found duplicate keys ', uuid, otherUuid);
                merge.set(otherUuid, uuid);
            }
        }
    }

    // Run multiple times to avoid regex errors
    replaceOccurrences(merge);
    replaceOccurrences(merge);
    replaceOccurrences(merge);

    console.log('Run unused-keys to clean up.');
}

function isMapEqual(a: Map<string, string>, b: Map<string, string>) {
    if (a.size !== b.size) {
        return false;
    }
    for (const [keyA, valueA] of a.entries()) {
        const valueB = b.get(keyA);
        if (valueB !== valueA) {
            return false;
        }
    }
    return true;
}
