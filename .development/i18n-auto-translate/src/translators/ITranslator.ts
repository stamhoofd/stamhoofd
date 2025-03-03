import { Translations } from "../types/Translations";

export interface ITranslator {
    translate(args: {text: string, originalLocal: string, targetLocal: string, namespace: string}): Promise<string>;
    translateAll(translations: Translations, args: {originalLocal: string, targetLocal: string, namespace: string}): Promise<Translations>;
}
