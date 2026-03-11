import fs from "fs";
import { validate as uuidValidate, v4 as uuidv4 } from "uuid";
import { getFilesToSearch } from "../shared/get-files-to-search";
import { getDefaultTranslations } from "./get-translations-with-path";
import { replaceOccurrences } from "./replace-keys-with-uuid";
import { writeTranslation } from "./write-translations";
import { isBase62 } from "./compress-uuids";

/**
 * Adds all usages of `$t(key)` in the code base - where they key is not present in the default translation file, to the default translation file (with a newly generated uuid). 
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
 * @returns the keys added to the default translation file
 */
export function addMissingKeys(): Record<string, string> {
    console.log("Start add missing keys.");
    const { filePath, translations } = getDefaultTranslations();
    const { missingKeys, filesWithMissingKeys } = getMissingKeys(translations);

    if (missingKeys.size > 0) {
        console.log(
            `Found ${missingKeys.size} missing key(s) in ${filesWithMissingKeys.size} file(s).`,
        );

        const missingUuidKeys = new Map<string, string>();
        const replacedKeys = new Map<string, string>();

        for (const key of missingKeys) {
            if (uuidValidate(key) || isBase62(key)) {
                missingUuidKeys.set(key, "todo");

                console.warn(
                    `Found missing translation for key ${key}. Replace the 'todo' in ${filePath} manually.`,
                );
            } else {
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
        replaceOccurrences(replacedKeys, Array.from(filesWithMissingKeys));
    } else {
        console.log("No missing keys found.");
    }

    console.log("Finished add missing keys.");
    return translations;
}

/**
 * Returns used keys ( $t(key) ), found anywhere in the source code, where the key is not present in the provided translations map, including the file where the keys are used.
 */
function getMissingKeys(translations: Record<string, string>): {
    missingKeys: Set<string>;
    filesWithMissingKeys: Set<string>;
} {
    // todo: use cache or pass with argument?
    const filesToSearch = getFilesToSearch(['typescript', 'vue']);
    
    const regexes = [
        // Regex to match $t('value')
         /\$t\([']([^']+)['](,.+)?\)/g,
         // Regex to match $t("value")
          /\$t\(["]([^"]+)["](,.+)?\)/g,
          // Regex to match $t(`value`)
           /\$t\([`]([^`]+)[`](,.+)?\)/g,
        // Regex to match $t('value',
         /\$t\([']([^']+)['](,.+)?,/g,
         // Regex to match $t("value")
          /\$t\(["]([^"]+)["](,.+)?,/g,
          // Regex to match $t(`value`)
           /\$t\([`]([^`]+)[`](,.+)?,/g
    ]

    const missingKeys = new Set<string>();
    const filesWithMissingKeys = new Set<string>();

    for (const filePath of filesToSearch) {
        const fileContent = fs.readFileSync(filePath, "utf8");

        let matches: RegExpExecArray | null;
        let hasMissingKey = false;

        // Extract all matches
        for(const regex of regexes) {
            while ((matches = regex.exec(fileContent)) !== null) {
                const key = matches[1];
    
                if (!translations[key]) {
                    missingKeys.add(key);
                    hasMissingKey = true;
                }
            }
        }

        if (hasMissingKey) {
            filesWithMissingKeys.add(filePath);
        }
    }

    return { missingKeys, filesWithMissingKeys };
}
