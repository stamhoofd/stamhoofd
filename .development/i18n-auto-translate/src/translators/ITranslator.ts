import { Batch } from "../types/Batch";
import { Translations } from "../types/Translations";

export type AfterBatchTranslatedCallback = (batch: Batch) => void;

export interface ITranslator {
    translateAll(
        translations: Translations,
        args: { originalLocal: string; targetLocal: string; namespace: string, afterBatchTranslated?: AfterBatchTranslatedCallback },
    ): Promise<Translations>;
}
