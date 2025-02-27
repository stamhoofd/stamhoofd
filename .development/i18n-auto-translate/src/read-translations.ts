import fs from "fs";
import { Translations } from "./types/Translations";
import { validateTranslations } from "./validate-translations";

export function readTranslationsAllowNull(filePath: string): Translations | null {
    if(!fs.existsSync(filePath)) {
        return null;
    }

    const parsedTranslations = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const validationResult = validateTranslations(parsedTranslations);

    if(validationResult.valid === false) {
        throw new Error(`Failed to read translations: ${validationResult.message}`);
    }

    return parsedTranslations;
}
