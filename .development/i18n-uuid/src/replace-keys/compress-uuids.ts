import { TranslationManager } from '../auto-translate/TranslationManager.js';
import { getTranslationsWithPath } from './get-translations-with-path.js';
import { replaceOccurrences } from './replace-keys-with-uuid.js';
import { writeTranslation } from './write-translations.js';

/**
 * Find translations that have the same translation for every language (machine translations are ignored because those are automatically generated and should resolve to the same value), and merge them.
 */
export function compressUuids() {
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
    replaceOccurrences(merge);

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
}

const START_CHAR = '%';
export function isBase62(str: string) {
    if (str.length > 10) {
        // skip: we won't reach here
        return false;
    }
    if (!str.startsWith(START_CHAR)) {
        return false;
    }

    try {
        decodeBase62(str);
        return true;
    }
    catch (e) {
        return false;
    }
}

const BASE62_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export function encodeBase62(num: number): string {
    if (num === 0) return START_CHAR + '0';

    let result = '';
    while (num > 0) {
        result = BASE62_CHARS[num % 62] + result;
        num = Math.floor(num / 62);
    }
    return START_CHAR + result;
}

export function decodeBase62(str: string): number {
    return str.substring(START_CHAR.length).split('').reduce((acc, char) => {
        const index = BASE62_CHARS.indexOf(char);
        if (index === -1) throw new Error(`Invalid Base62 character: '${char}'`);
        return acc * 62 + index;
    }, 0);
}
