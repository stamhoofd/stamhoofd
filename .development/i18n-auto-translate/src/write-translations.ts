import fs from "fs";
import { Translations } from "./types/Translations";

export function writeMultipleTranslations(translationsWithPath: Map<string, Translations>) {
    for (const [filePath, translations] of translationsWithPath) {
        writeTranslation(filePath, translations);
    }
}

export function writeTranslation(filePath: string, translations: Translations) {
    fs.writeFileSync(filePath, JSON.stringify(translations, null, 2));
}
