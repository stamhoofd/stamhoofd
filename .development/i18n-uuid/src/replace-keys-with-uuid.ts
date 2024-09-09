import fs from "fs";
import { v4 as uuidv4, validate as uuidValidate } from "uuid";
import { getFilesToSearch } from "./get-files-to-search";
import { getTranslationsWithPath } from "./get-translations-with-path";

export function replaceKeysWithUuid() {
    const translationsWithPath = getTranslationsWithPath();
    replaceKeysWithUuidInTranslations(translationsWithPath);
}

type TranslationValue =
    | string
    | {
          [key: string]: TranslationValue;
      };

function replaceKeysWithUuidInTranslations(
    translationsWithPath: Map<string, Record<string, string>>,
) {
    const keysToSkip = ["replacements"];
    // oldKey, newKey
    const replacedKeys = new Map<string, string>();

    const setTranslationsOnResult = (
        result: Record<string, string>,
        translations: TranslationValue,
        parentKeys = "",
    ) => {
        if (typeof translations === "string") {
            throw new Error(`Unexpected string: ${translations}`);
        }

        for (const key in translations) {
            if (keysToSkip.includes(key)) continue;
            const fullKey = parentKeys ? `${parentKeys}.${key}` : key;

            const setOnResult = (uuidKey: string) => {
                delete result[key];
                result[uuidKey] = translations[key] as string;
            };

            if (replacedKeys.has(fullKey)) {
                const uuidKey = replacedKeys.get(fullKey)!;
                setOnResult(uuidKey);
                continue;
            } else if (isUuid(key)) continue;

            const value = translations[key];

            if (typeof value === "string") {
                const uuidKey = uuidv4();
                replacedKeys.set(fullKey, uuidKey);
                setOnResult(uuidKey);
                continue;
            }

            setTranslationsOnResult(result, value, fullKey);
            delete result[key];
        }
    };

    for (const [filePath, translations] of translationsWithPath) {
        const newTranslations = { ...translations };
        setTranslationsOnResult(newTranslations, translations);
        fs.writeFileSync(filePath, JSON.stringify(newTranslations, null, 2));
        console.log(`Replaced keys with UUIDs in: ${filePath}`);
    }

    replaceOccurrences(replacedKeys);
}

function isUuid(key: string) {
    return uuidValidate(key);
}

export function replaceOccurrences(replacedKeys: Map<string, string>, files: string[] = getFilesToSearch()) {
    if(replacedKeys.size === 0) return;
    for(const file of files) {
        const fileContent = fs.readFileSync(file, 'utf8');
        let newContent = fileContent;

        for(const [oldKey, newKey] of replacedKeys.entries()) {
            const toReplace: {searchValue: RegExp, replaceValue: string}[] = [
                {searchValue: createRegexPattern(`\$t('${oldKey}'`), replaceValue: `$t('${newKey}'`},
                {searchValue: createRegexPattern(`\$t("${oldKey}"`), replaceValue: `$t("${newKey}"`},
                {searchValue: createRegexPattern(`\$t(\`${oldKey}\``), replaceValue: `$t(\`${newKey}\``},
            ]

            for(const {searchValue, replaceValue} of toReplace) {
                const containsPattern = searchValue.test(newContent);
                if(!containsPattern) continue;
                
                newContent = newContent.replace(searchValue, replaceValue);
                break;
            }
        }

        if(fileContent !== newContent) {
            console.log('Replaced keys in ' + file);
            fs.writeFileSync(file, newContent);
        }
    }
}

function escapeRegExp(stringToGoIntoTheRegex: string): string {
    return stringToGoIntoTheRegex.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

function createRegexPattern(stringToGoIntoTheRegex: string): RegExp {
    return new RegExp(escapeRegExp(stringToGoIntoTheRegex), 'g');
}

