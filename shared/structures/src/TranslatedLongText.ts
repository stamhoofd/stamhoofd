import type { LanguageMap } from '@stamhoofd/types/LanguageMap';

import { definePlainTextDecoders, TranslatedPlainText } from './TranslatedPlainText.js';

/**
 * A description of a few sentences, in one block: edited in a growing text box where Enter does
 * nothing, and shown as wrapping text, so it may not be put in a cramped place. Use TranslatedRichText
 * for anything with line breaks or formatting.
 */
export class TranslatedLongText extends TranslatedPlainText {
    static create(translations: LanguageMap | string = ''): TranslatedLongText {
        return new TranslatedLongText(translations);
    }

    static field(options: Parameters<typeof decoders.field>[0] = {}) {
        return decoders.field(options);
    }
}

const decoders = definePlainTextDecoders<TranslatedLongText>(translations => new TranslatedLongText(translations));

export const TranslatedLongTextDecoder = decoders.decoder;
export const TranslatedLongTextPatchDecoder = decoders.patchDecoder;
