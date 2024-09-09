import fs from "fs";
import { validate as uuidValidate, v4 as uuidv4 } from "uuid";
import { getFilesToSearch } from "./get-files-to-search";
import { getDefaultTranslations } from "./get-translations-with-path";
import { replaceOccurrences } from "./replace-keys-with-uuid";
import { writeTranslation } from "./write-translations";

/**
 * Add keys from source files to the default .json translation files,
 * if they do not already exist.
 * @returns the default languages with the missing keys added
 */
export function addMissingKeys(): Record<string, string> {
    console.log("Start add missing keys.");
    const { filePath, translations } = getDefaultTranslations();
    const { missingKeys, filesWithMissingKeys } = getMissingKeys(translations);

    if (missingKeys.size > 0) {
        console.log(
            `Found ${missingKeys.size} missing key(s) in ${filesWithMissingKeys.size} file(s).`,
        );

        //#region create uuid for missing keys
        const missingUuidKeys = new Map<string, string>();
        const replacedKeys = new Map<string, string>();

        for (const key of missingKeys) {
            if (uuidValidate(key)) {
                missingUuidKeys.set("todo", key);
            } else {
                const uuid = uuidv4();
                replacedKeys.set(key, uuid);
            }
        }
        //#endregion

        // replace the missing key with the uuid
        replaceOccurrences(replacedKeys, Array.from(filesWithMissingKeys));

        //#region add the keys and the value to the default translations
        for (const [oldKey, newKey] of new Map([
            ...replacedKeys,
            ...missingUuidKeys,
        ]).entries()) {
            if (translations[newKey]) continue;
            translations[newKey] = oldKey;
        }

        writeTranslation(filePath, translations);
        //#endregion
    } else {
        console.log("No missing keys found.");
    }

    console.log("Finished add missing keys.");
    return translations;
}

function getMissingKeys(translations: Record<string, string>): {
    missingKeys: Set<string>;
    filesWithMissingKeys: Set<string>;
} {
    // todo: use cache or pass with argument?
    const filesToSearch = getFilesToSearch();

    // Regex to match $t('value') or $t("value")
    const regex = /\$t\(['"]([^'"]+)['"]\)/g;

    const missingKeys = new Set<string>();
    const filesWithMissingKeys = new Set<string>();

    for (const filePath of filesToSearch) {
        const fileContent = fs.readFileSync(filePath, "utf8");

        let matches: RegExpExecArray | null;
        let hasMissingKey = false;

        // Extract all matches
        while ((matches = regex.exec(fileContent)) !== null) {
            const key = matches[1];

            if (!translations[key]) {
                missingKeys.add(key);
                hasMissingKey = true;
            }
        }

        if (hasMissingKey) {
            filesWithMissingKeys.add(filePath);
        }
    }

    return { missingKeys, filesWithMissingKeys };
}
