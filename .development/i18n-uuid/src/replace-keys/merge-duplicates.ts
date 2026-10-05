import { decodeBase62, isBase62 } from './compress-uuids.js';
import { getTranslationsWithPath } from './get-translations-with-path.js';
import { findUnusedTranslationKeys, replaceOccurrences } from './replace-keys-with-uuid.js';
import { writeTranslation } from './write-translations.js';
import { reportProgress } from '../shared/progress.js';
import type { ProgressCallback } from '../shared/progress.js';

/**
 * Find translations that have the same translation for every language (machine translations are ignored because those are automatically generated and should resolve to the same value), and merge them.
 */
export async function mergeDuplicates(onProgress?: ProgressCallback) {
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
    let completed = 0;
    await reportProgress(onProgress, { phase: 'compare', completed, total: translationsForKeys.size });
    for (const [uuid, values] of translationsForKeys.entries()) {
        for (const [otherUuid, otherValues] of translationsForKeys.entries()) {
            if (otherUuid === uuid) {
                continue;
            }

            if (otherUuid > uuid) {
                // Already checked in the other direction
                continue;
            }

            if (!isBase62(uuid) || !isBase62(otherUuid)) {
                // Cannot compare first
                continue;
            }

            if (isMapEqual(values, otherValues)) {
                const uuidVal = decodeBase62(uuid);
                const otherUuidVal = decodeBase62(otherUuid)

                if (uuidVal <= otherUuidVal) {
                    // uuid should be the goal, replace otheruuid with uuid
                    merge.set(otherUuid, uuid);
                } else {
                    // uuid should be the goal, replace otheruuid with uuid
                    merge.set(uuid, otherUuid);
                }
            }
        }
        await reportProgress(onProgress, { phase: 'compare', completed: ++completed, total: translationsForKeys.size });
    }

    // Run multiple times to avoid regex errors
    await replaceOccurrences(merge, undefined, onProgress);
    await replaceOccurrences(merge, undefined, onProgress);
    await replaceOccurrences(merge, undefined, onProgress);
    return merge.size;
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
