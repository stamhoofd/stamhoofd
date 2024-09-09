import fs from "fs";

export function writeTranslations(translationsWithPath: Map<string, Record<string, string>>) {
    for (const [filePath, translations] of translationsWithPath) {
        fs.writeFileSync(filePath, JSON.stringify(translations, null, 2));
    }
}
