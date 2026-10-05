import fs from 'fs';
import { validate as uuidValidate, v4 as uuidv4 } from 'uuid';
import { getFilesToSearch, translatableFileTypes } from '../shared/get-files-to-search.js';
import { getDefaultTranslations } from './get-translations-with-path.js';
import { findTranslationKeyUsages, replaceOccurrences } from './replace-keys-with-uuid.js';
import { writeTranslation } from './write-translations.js';
import { isBase62 } from './compress-uuids.js';
import { reportProgress } from '../shared/progress.js';
import type { ProgressCallback } from '../shared/progress.js';

/**
 * Adds all usages of `$t(key)` (TypeScript / Vue) and `{{$t "key"}}` (Handlebars) in the code base - where they key is not present in the default translation file, to the default translation file (with a newly generated uuid).
 * It also replaces the keys with the generated uuids in the files.
 *
 * 1. So for `$t("Hello world")` this adds an entry in nl.json:
 *    ```json
 *    {
 *        "generated-uuid": "Hello world"
 *    }
 *    ```
 *    And it chagnes `$t("Hello world")` to `$t("generated-uuid")`
 *
 * 2. if the key is aalready an existing uuid, we'll set it to 'todo' (means the uuid is missing and has no translation yet)
 *    ```json
 *    {
 *        "uuid-uuid-uuid": "todo"
 *    }
 *     ```
 *    The key won't be replaced in the $t in this case.
 *
 * @returns the number of keys added to the default translation file
 */
export async function addMissingKeys(onProgress?: ProgressCallback): Promise<number> {
    const { filePath, translations } = getDefaultTranslations();
    const { missingKeys, filesWithMissingKeys } = await getMissingKeys(translations, onProgress);

    if (missingKeys.size > 0) {
        const missingUuidKeys = new Map<string, string>();
        const replacedKeys = new Map<string, string>();

        for (const key of missingKeys) {
            if (uuidValidate(key) || isBase62(key)) {
                missingUuidKeys.set(key, 'todo');

                console.warn(
                    `Found missing translation for key ${key}. Replace the 'todo' in ${filePath} manually.`,
                );
            }
            else {
                const uuid = uuidv4();
                replacedKeys.set(key, uuid);
            }
        }

        // First replace keys
        for (const [value, key] of new Map([
            ...replacedKeys,
        ]).entries()) {
            translations[key] = value;
        }

        // Missing keys
        for (const [key, value] of new Map([
            ...missingUuidKeys,
        ]).entries()) {
            if (translations[key]) {
                // Already exists
                continue;
            }
            translations[key] = value;
        }

        // First write the translation files (no risk of losing data)
        // Add the uuids to the nl.json file
        writeTranslation(filePath, translations);

        // Replace the translations with the generated keys. Run multiple times because this sometimes fails
        await replaceOccurrences(replacedKeys, Array.from(filesWithMissingKeys), onProgress);
    }
    return missingKeys.size;
}

/**
 * Returns used keys ( $t(key) ), found anywhere in the source code, where the key is not present in the provided translations map, including the file where the keys are used.
 */
async function getMissingKeys(translations: Record<string, string>, onProgress?: ProgressCallback): Promise<{
    missingKeys: Set<string>;
    filesWithMissingKeys: Set<string>;
}> {
    const filesToSearch = getFilesToSearch(translatableFileTypes);

    const missingKeys = new Set<string>();
    const filesWithMissingKeys = new Set<string>();
    let completed = 0;
    await reportProgress(onProgress, { phase: 'scan', completed, total: filesToSearch.length });

    for (const filePath of filesToSearch) {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        let hasMissingKey = false;

        for (const key of findTranslationKeyUsages(fileContent)) {
            if (!translations[key]) {
                missingKeys.add(key);
                hasMissingKey = true;
            }
        }

        if (hasMissingKey) {
            filesWithMissingKeys.add(filePath);
        }
        await reportProgress(onProgress, { phase: 'scan', completed: ++completed, total: filesToSearch.length });
    }

    return { missingKeys, filesWithMissingKeys };
}
