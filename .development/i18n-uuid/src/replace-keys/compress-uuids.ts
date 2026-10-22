import { TranslationManager } from '../auto-translate/TranslationManager.js';
import { getTranslationsWithPath } from './get-translations-with-path.js';
import { replaceOccurrences } from './replace-keys-with-uuid.js';
import { writeTranslation } from './write-translations.js';
import type { ProgressCallback } from '../shared/progress.js';
import { decodeBase62, encodeBase62, isBase62 } from './base62.js';

export { decodeBase62, encodeBase62, isBase62 } from './base62.js';

/**
 * Find translations that have the same translation for every language (machine translations are ignored because those are automatically generated and should resolve to the same value), and merge them.
 */
export async function compressUuids(onProgress?: ProgressCallback) {
    const translationsWithPath = getTranslationsWithPath();

    const usedKeys = new Set<string>();

    // Build map
    let largestBase62 = -1;

    for (const [filePath, translations] of translationsWithPath) {
        for (const key in translations) {
            if (key === 'replacements' || key === 'extends' || key === 'consistent-words') {
                continue;
            }
            if (typeof translations[key] === 'string') {
                if (!usedKeys.has(key)) {
                    usedKeys.add(key);
                    if (isBase62(key)) {
                        largestBase62 = Math.max(decodeBase62(key), largestBase62);
                    }
                }
            }
        }
    }

    // Find uuids in translationsForKeys with the exact same content (so same map keys and values, same size)
    const merge: Map<string, string> = new Map();
    for (const uuid of usedKeys.values()) {
        if (!isBase62(uuid)) {
            // todo compress
            largestBase62 += 1;
            merge.set(uuid, encodeBase62(largestBase62));
        }
    }

    // Replace the keys in the translation files
    for (const [filePath, translations] of translationsWithPath) {
        let updateRequired = false;

        for (const key in translations) {
            if (key === 'replacements' || key === 'extends' || key === 'consistent-words') {
                continue;
            }
            if (typeof translations[key] === 'string') {
                const replace = merge.get(key);
                if (replace) {
                    translations[replace] = translations[key];
                    delete translations[key];
                    updateRequired = true;
                }
            }
        }

        if (updateRequired) {
            writeTranslation(filePath, translations);
        }
    }

    // Also replace in all translation files
    // Run multiple times to avoid regex errors
    await replaceOccurrences(merge, undefined, onProgress);

    // Replace machine translations
    const manager = new TranslationManager();
    manager.iterateNonDefaultLocalesWithNamespace((locale, namespace) => {
        const dict = manager.readMachineTranslationDictionary(locale, namespace);
        const filteredDictionary = {};

        for (const [key, value] of Object.entries(dict)) {
            const k = merge.get(key);
            if (k) {
                filteredDictionary[k] = value;
            }
            else {
                filteredDictionary[key] = value;
            }
        }

        manager.setMachineTranslationDictionary(filteredDictionary, {
            locale,
            namespace,
        });
    });
    return merge.size;
}
