import fs from 'fs';
import { v4 as uuidv4, validate as uuidValidate } from 'uuid';
import { getFilesToSearch, translatableFileTypes } from '../shared/get-files-to-search.js';
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

/**
 * Regexes matching a translation key usage in source files. The key is the first capture group.
 * - TypeScript / Vue: `$t('key')`, `$t("key")`, `$t(`key`)`, optionally followed by arguments
 * - Handlebars: `{{$t "key"}}`, `{{$t 'key'}}`
 */
const keyUsageRegexes: RegExp[] = [
    /\$t\('([^']+)'(,.+)?[),]/g,
    /\$t\("([^"]+)"(,.+)?[),]/g,
    /\$t\(`([^`]+)`(,.+)?[),]/g,
    /\$t\s+'([^']+)'/g,
    /\$t\s+"([^"]+)"/g,
];

/**
 * Returns all keys used in `$t(...)` (TypeScript / Vue) or `{{$t "..."}}` (Handlebars) in the given file content.
 */
export function findTranslationKeyUsages(fileContent: string): Set<string> {
    const keys = new Set<string>();
    for (const regex of keyUsageRegexes) {
        regex.lastIndex = 0;
        let matches: RegExpExecArray | null;
        while ((matches = regex.exec(fileContent)) !== null) {
            keys.add(matches[1]);
        }
    }
    return keys;
}

function createKeyPatterns(key: string): { searchValue: RegExp; replaceValue: (newKey: string) => string }[] {
    const escapedKey = escapeRegExp(key);
    return [
        { searchValue: createRegexPattern(`$t('${key}'`), replaceValue: newKey => `$t('${newKey}'` },
        { searchValue: createRegexPattern(`$t("${key}"`), replaceValue: newKey => `$t("${newKey}"` },
        { searchValue: createRegexPattern(`$t(\`${key}\``), replaceValue: newKey => `$t(\`${newKey}\`` },
        { searchValue: new RegExp(`\\$t(\\s+)'${escapedKey}'`, 'g'), replaceValue: newKey => `$t$1'${newKey}'` },
        { searchValue: new RegExp(`\\$t(\\s+)"${escapedKey}"`, 'g'), replaceValue: newKey => `$t$1"${newKey}"` },
    ];
}

/**
 * Replaces every usage of the old keys with the new keys in the given content.
 */
export function replaceOccurrencesInContent(content: string, replacedKeys: Map<string, string>): string {
    let newContent = content;

    for (const [oldKey, newKey] of replacedKeys.entries()) {
        for (const { searchValue, replaceValue } of createKeyPatterns(oldKey)) {
            newContent = newContent.replace(searchValue, replaceValue(newKey));
        }
    }

    return newContent;
}

export function replaceOccurrences(replacedKeys: Map<string, string>, files: string[] = getFilesToSearch(translatableFileTypes)) {
    if (replacedKeys.size === 0) return;
    for (const file of files) {
        const fileContent = fs.readFileSync(file, 'utf8');
        const newContent = replaceOccurrencesInContent(fileContent, replacedKeys);

        if (fileContent !== newContent) {
            console.log('Replaced keys in ' + file);
            fs.writeFileSync(file, newContent);
        }
    }
}

export function findUnusedTranslationKeys(keys: Set<string>, files: string[] = getFilesToSearch(translatableFileTypes)) {
    if (keys.size === 0) return new Set<string>();

    const remaining = new Set<string>(keys);
    for (const file of files) {
        const fileContent = fs.readFileSync(file, 'utf8');

        for (const key of remaining.values()) {
            const isUsed = createKeyPatterns(key).some(({ searchValue }) => searchValue.test(fileContent));
            if (isUsed) {
                remaining.delete(key);
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
