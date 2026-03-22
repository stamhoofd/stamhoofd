import type { Batch } from '../../types/Batch.js';
import type { Translations } from '../../types/Translations.js';
import type { TranslationWithVariant } from '../../types/TranslationWithVariant.js';

export type AfterBatchTranslatedCallback = (batch: Batch<string>) => void;

export interface ITranslator {
    translateAll(
        translations: Translations,
        args: { originalLocal: string; targetLocal: string; namespace: string; afterBatchTranslated?: AfterBatchTranslatedCallback },
    ): Promise<Translations>;

    translateAllVariants(
        translationsWithVariant: Record<string, TranslationWithVariant>,
        args: { originalLocal: string; targetLocal: string; namespace: string; afterBatchTranslated?: AfterBatchTranslatedCallback },
    ): Promise<Translations>;
}
