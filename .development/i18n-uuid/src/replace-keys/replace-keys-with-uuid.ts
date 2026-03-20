import fs from 'fs';
import { v4 as uuidv4, validate as uuidValidate } from 'uuid';
import { getFilesToSearch } from '../shared/get-files-to-search.js';
import { getTranslationsWithPath } from './get-translations-with-path.js';
import { writeTranslation } from './write-translations.js';
import { isBase62 } from './compress-uuids.js';

/**
 * Searches for keys that are present in translation files that are not uuids, and replaces them with uuids in both the locale.json file and the $t(keys).
 *
 * Transforms
 * ```json
 * {
 *      "Not a uuid": "Some translation",
 *      "namespace": {
 *           "not a uuid": "Other translation"
 *      }
 * }
 * ```
 *
 * into
 *
 * ```json
 * {
 *      "uuid1": "Some translation",
 *      "uuid2": "Other translation"
 * }
 * ```
 *
 * and replaces the keys in all source files
 * - `$t('Not a uuid')` → `$t('uuid1')`
 * - `$t('namespace.not a uuid')` → `$t('uuid2')`
 *
 */
export function replaceKeysWithUuid() {
    console.log('Start replace keys with uuids.');
    const translationsWithPath = getTranslationsWithPath();
    replaceKeysWithUuidInTranslations(translationsWithPath);
    console.log('Finished replace keys with uuids.');
}

type TranslationValue =
    | string
    | {
        [key: string]: TranslationValue;
    };

function replaceKeysWithUuidInTranslations(
    translationsWithPath: Map<string, Record<string, string>>,
) {
    const keysToSkip = ['replacements', 'extends', 'consistent-words'];
    // oldKey, newKey
    const replacedKeys = new Map<string, string>();

    const flattenTranslationsAndReplaceKeys = (
        result: Record<string, string>,
        translations: TranslationValue,
        parentKeys = '',
    ): number => {
        if (typeof translations === 'string') {
            throw new Error(`Unexpected string: ${translations}`);
        }

        let changes = 0;

        for (const key in translations) {
            if (keysToSkip.includes(key)) continue;
            const fullKey = parentKeys ? `${parentKeys}.${key}` : key;

            const setOnResult = (uuidKey: string) => {
                delete result[key];
                result[uuidKey] = translations[key] as string;
                changes++;
            };

            if (replacedKeys.has(fullKey)) {
                const uuidKey = replacedKeys.get(fullKey)!;
                setOnResult(uuidKey);
                continue;
            }
            else if (isUuid(key) || isBase62(key)) continue;

            const value = translations[key];

            if (typeof value === 'string') {
                // For now inject a uuidv4 - we'll replace it with an auto incrementing ID when we loaded all translations into memory
                const uuidKey = uuidv4();
                replacedKeys.set(fullKey, uuidKey);
                setOnResult(uuidKey);
                continue;
            }

            const deepChanges = flattenTranslationsAndReplaceKeys(result, value, fullKey);
            delete result[key];
            changes += deepChanges;
        }

        return changes;
    };

    for (const [filePath, translations] of translationsWithPath) {
        const newTranslations = { ...translations };
        const changes = flattenTranslationsAndReplaceKeys(newTranslations, translations);

        if (changes > 0) {
            writeTranslation(filePath, newTranslations);
            console.log(`Replaced ${changes} key(s) with UUIDs in: ${filePath}`);
        }
    }

    replaceOccurrences(replacedKeys);
}

function isUuid(key: string) {
    return uuidValidate(key);
}

export function replaceOccurrences(replacedKeys: Map<string, string>, files: string[] = getFilesToSearch(['typescript', 'vue'])) {
    if (replacedKeys.size === 0) return;
    for (const file of files) {
        const fileContent = fs.readFileSync(file, 'utf8');
        let newContent = fileContent;

        for (const [oldKey, newKey] of replacedKeys.entries()) {
            const toReplace: { searchValue: RegExp; replaceValue: string }[] = [
                { searchValue: createRegexPattern(`$t('${oldKey}'`), replaceValue: `$t('${newKey}'` },
                { searchValue: createRegexPattern(`$t("${oldKey}"`), replaceValue: `$t("${newKey}"` },
                { searchValue: createRegexPattern(`$t(\`${oldKey}\``), replaceValue: `$t(\`${newKey}\`` },
            ];

            for (const { searchValue, replaceValue } of toReplace) {
                newContent = newContent.replace(searchValue, replaceValue);
            }
        }

        if (fileContent !== newContent) {
            console.log('Replaced keys in ' + file);
            fs.writeFileSync(file, newContent);
        }
    }
}

export function findUnusedTranslationKeys(keys: Set<string>, files: string[] = getFilesToSearch(['typescript', 'vue'])) {
    if (keys.size === 0) return new Set<string>();

    const remaining = new Set<string>(keys);
    for (const file of files) {
        const fileContent = fs.readFileSync(file, 'utf8');
        const newContent = fileContent;

        for (const key of remaining.values()) {
            const toReplace: { searchValue: RegExp }[] = [
                { searchValue: createRegexPattern(`$t('${key}'`) },
                { searchValue: createRegexPattern(`$t("${key}"`) },
                { searchValue: createRegexPattern(`$t(\`${key}\``) },
            ];

            for (const { searchValue } of toReplace) {
                const didMatch = newContent.match(searchValue);
                if (didMatch) {
                    remaining.delete(key);
                    break;
                }
            }
        }

        if (remaining.size === 0) {
            // all found
            break;
        }
    }
    return remaining;
}

function escapeRegExp(stringToGoIntoTheRegex: string): string {
    return stringToGoIntoTheRegex.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}

function createRegexPattern(stringToGoIntoTheRegex: string): RegExp {
    return new RegExp(escapeRegExp(stringToGoIntoTheRegex), 'g');
}
