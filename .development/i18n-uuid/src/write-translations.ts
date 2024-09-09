import fs from "fs";

export function writeMultipleTranslations(translationsWithPath: Map<string, Record<string, string>>) {
    for (const [filePath, translations] of translationsWithPath) {
        writeTranslation(filePath, translations);
    }
}

export function writeTranslation(filePath: string, translations: Record<string, string>) {
    fs.writeFileSync(filePath, JSON.stringify(translations, null, 2));
}
