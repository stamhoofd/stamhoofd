import fs from "fs";
import { Translations } from "./types/Translations";
import { validateTranslations } from "./validate-translations";

export function readTranslationsAllowNull(filePath: string, allowedObjects: string[] | null = []): Translations | null {
    if(!fs.existsSync(filePath)) {
        return null;
    }

    const parsedTranslations = JSON.parse(fs.readFileSync(filePath, "utf8"));

    if(allowedObjects !== null) {
        for(const [key, value] of Object.entries(parsedTranslations)) {
            if(typeof value === "object") {
                if(allowedObjects.includes(key)) {
                    continue;
                }
                delete parsedTranslations[key];
            }
        }
    }

    const validationResult = validateTranslations(parsedTranslations, allowedObjects);

    if(validationResult.valid === false) {
        throw new Error(`Failed to read translations: ${validationResult.message}`);
    }

    return parsedTranslations;
}
