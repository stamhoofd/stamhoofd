import fs from "fs";
import { validate as uuidValidate, v4 as uuidv4 } from "uuid";
import { getFilesToSearch } from "./get-files-to-search";
import { getTranslationsWithPath } from "./get-translations-with-path";
import { replaceOccurrences } from "./replace-keys-with-uuid";
import { writeTranslations } from "./write-translations";

/**
 * Search for missing keys in files and add them to the .json translation files.
 */

export function addMissingKeys() {
    const translationsWithPath = getTranslationsWithPath();
    const {missingKeys, filesWithMissingKeys} = getMissingKeys();

    const replacedKeys = new Map<string, string>();

    for(const key of missingKeys) {
        const uuid = uuidv4();
        replacedKeys.set(key, uuid);
    }

    replaceOccurrences(replacedKeys, Array.from(filesWithMissingKeys));

    addKeysToTranslations(translationsWithPath, replacedKeys);
    writeTranslations(translationsWithPath);
}

function getMissingKeys(): {missingKeys: Set<string>, filesWithMissingKeys: Set<string>} {
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

            if (!uuidValidate(key)) {
                missingKeys.add(key);
                hasMissingKey = true;
            }
        }

        if(hasMissingKey) {
            filesWithMissingKeys.add(filePath);
        }
    }

    return {missingKeys, filesWithMissingKeys};
}

export function addKeysToTranslations(translationsWithPath: Map<string, Record<string, string>>, replacedKeys: Map<string, string>): void {
    for(const translations of translationsWithPath.values()) {
        for(const [oldKey, newKey] of replacedKeys.entries()) {
            if(translations[newKey]) continue;
            translations[newKey] = oldKey;
        }
    }
}
