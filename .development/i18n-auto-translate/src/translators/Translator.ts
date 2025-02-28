import { Translations } from "../types/Translations";
import { ITranslator } from "./ITranslator";


export class Translator implements ITranslator {
    constructor() {}

    async translate(args: {text: string, originalLocal: string, targetLocal: string}): Promise<string> {
        return `TRANSLATED from ${args.originalLocal} to ${args.targetLocal} > ${args.text}`;
    }

    async translateAll(translations: Translations, {originalLocal, targetLocal}: { originalLocal: string; targetLocal: string; }): Promise<Translations> {

        const result: Translations = {};

        for(const [id, text] of Object.entries(translations)) {
            const translation = await this.translate({text, originalLocal, targetLocal});
            result[id] = translation;
        }

        return result;
    }
}
