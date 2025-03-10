import { TranslatorType } from "../enums/TranslatorType";

export function isTranslatorType(translatorType: string): boolean {
    return Object.values(TranslatorType).map(type => type.toLowerCase()).includes(translatorType.toLowerCase());
}
