import fs from "fs";
import path from "path";
import { v4 as uuidv4, validate as uuidValidate } from "uuid";

export function replaceKeysWithUuid() {
    const translationsWithPath = getTranslationsWithPath();
    replaceKeysWithUuidInTranslations(translationsWithPath);
}

function getTranslationsWithPath() {
    // Path to the directory containing your translation files (e.g., locales/en.json)
    const localesDir = "../../shared/locales/src";

    const result = new Map();

    const files = fs.readdirSync(localesDir);
    console.log(files)

    const filePaths: string[] = [];

    const addTranslationFilePaths = (dir: string) => {
        const files = fs.readdirSync(dir);

        for(const file of files) {
            const filePath = path.join(dir, file);
    
            const stats = fs.statSync(filePath);
    
            if(stats.isFile()) {
                if(filePath.endsWith(".json")) {
                   filePaths.push(filePath); 
                }
    
                continue;
            }

            if(stats.isDirectory()) {
                console.log('directory: ', filePath)
                addTranslationFilePaths(filePath);
            }
        }
    }

    addTranslationFilePaths(localesDir);

    for (const filePath of filePaths) {
        const translations = JSON.parse(fs.readFileSync(filePath, "utf8"));
        result.set(filePath, translations);
    }

    return result;
}

type TranslationValue = string | {
    [key: string]: TranslationValue};

function replaceKeysWithUuidInTranslations(
    translationsWithPath: Map<string, Record<string, string>>,
) {
    const keysToSkip = ['replacements'];
    const replacedKeys = new Map<string, string>();

    const setTranslationsOnResult = (result: Record<string, string>, translations: TranslationValue, parentKeys = '') => {
        if(typeof translations === 'string') {
            throw new Error(`Unexpected string: ${translations}`);
        }

        for (const key in translations) {
            if(keysToSkip.includes(key)) continue;
            const fullKey = parentKeys ? `${parentKeys}.${key}` : key;

            const setOnResult = (uuidKey: string) => {
                delete result[key];
                result[uuidKey] = translations[key] as string;
            }
            
            if (replacedKeys.has(fullKey)) {
                const uuidKey = replacedKeys.get(fullKey)!;
                setOnResult(uuidKey);
                continue;
            } else if (isUuid(key)) continue;

            const value = translations[key];

            if(typeof value === 'string') {
                const uuidKey = uuidv4();
                replacedKeys.set(fullKey, uuidKey);
                setOnResult(uuidKey);
                continue;
            }

            setTranslationsOnResult(result, value, fullKey);
            delete result[key];
        }
    }

    for (const [filePath, translations] of translationsWithPath) {
        const newTranslations = { ...translations };
        setTranslationsOnResult(newTranslations, translations);
        fs.writeFileSync(filePath, JSON.stringify(newTranslations, null, 2));
        console.log(`Replaced keys with UUIDs in: ${filePath}`);
    }
}

function isUuid(key: string) {
    return uuidValidate(key);
}

function findOccurrences(string: string, substring: string) {

}
