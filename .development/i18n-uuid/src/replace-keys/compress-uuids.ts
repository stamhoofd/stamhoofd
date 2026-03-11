import { validate as uuidValidate } from "uuid";
import { getTranslationsWithPath } from "./get-translations-with-path";
import { replaceOccurrences } from "./replace-keys-with-uuid";
import { writeTranslation } from "./write-translations";

/**
 * Find translations that have the same translation for every language (machine translations are ignored because those are automatically generated and should resolve to the same value), and merge them.
 */
export function compressUuids() {
    const translationsWithPath = getTranslationsWithPath();

    const usedKeys = new Set<string>();

    // Build map
    let largestBase62 = 0;

    for (const [filePath, translations] of translationsWithPath) {
        for (const key in translations) {
            if (key === 'replacements' || key === 'extends' || key === 'consistent-words') {
                continue;
            }
            if (typeof translations[key] === 'string') {
                if (!usedKeys.has(key)) {
                    usedKeys.add(key);
                    if (isBase62(key)) {
                        largestBase62 = Math.max(decodeBase62(key), largestBase62)
                    }
                }
            }
        }
    }

    

    // Find uuids in translationsForKeys with the exact same content (so same map keys and values, same size)
    let merge: Map<string, string> = new Map();
    for (const uuid of usedKeys.values()) {
        if (isUuid(uuid)) {
            // todo compress
            merge.set(uuid, encodeBase62(largestBase62));
            largestBase62 += 1;
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
                if(replace) {
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
    replaceOccurrences(merge)
    replaceOccurrences(merge)
    replaceOccurrences(merge)

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

function isUuid(key: string) {
    return uuidValidate(key);
}

export function isBase62(str: string) {
    if (str.length > 10) {
        // skip: we won't reach here
        return false;
    }

    try {
        decodeBase62(str)
        return true;
    } catch (e) {
        return false;
    }
}

const BASE62_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function encodeBase62(num: number): string {
  if (num === 0) return '0';

  let result = '';
  while (num > 0) {
    result = BASE62_CHARS[num % 62] + result;
    num = Math.floor(num / 62);
  }
  return result;
}

function decodeBase62(str: string): number {
  return str.split('').reduce((acc, char) => {
    const index = BASE62_CHARS.indexOf(char);
    if (index === -1) throw new Error(`Invalid Base62 character: '${char}'`);
    return acc * 62 + index;
  }, 0);
}
