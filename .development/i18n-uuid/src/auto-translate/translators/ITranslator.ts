import { Batch } from "../../types/Batch";
import { Translations } from "../../types/Translations";
import { TranslationWithVariant } from "../../types/TranslationWithVariant";

export type AfterBatchTranslatedCallback = (batch: Batch<string>) => void;

export interface ITranslator {
    translateAll(
        translations: Translations,
        args: { originalLocal: string; targetLocal: string; namespace: string, afterBatchTranslated?: AfterBatchTranslatedCallback },
    ): Promise<Translations>;

    translateAllVariants(
        translationsWithVariant: Record<string, TranslationWithVariant>,
        args: { originalLocal: string; targetLocal: string; namespace: string, afterBatchTranslated?: AfterBatchTranslatedCallback },
    ): Promise<Translations>;
}
