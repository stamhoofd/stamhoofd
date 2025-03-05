import { Translations } from "../types/Translations";

export interface ITranslator {
    translateAll(
        translations: Translations,
        args: { originalLocal: string; targetLocal: string; namespace: string },
    ): Promise<Translations>;
}
