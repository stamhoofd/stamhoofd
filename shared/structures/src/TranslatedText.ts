import type { LanguageMap } from '@stamhoofd/types/LanguageMap';

import { definePlainTextDecoders, TranslatedPlainText } from './TranslatedPlainText.js';

/**
 * A name, a title or a label: edited in a small input box, so it has to stay short enough for a
 * cramped place. Use TranslatedLongText for a description of a few sentences, and TranslatedRichText
 * for anything with line breaks or formatting.
 */
export class TranslatedText extends TranslatedPlainText {
    static create(translations: LanguageMap | string = ''): TranslatedText {
        return new TranslatedText(translations);
    }

    static field(options: Parameters<typeof decoders.field>[0] = {}) {
        return decoders.field(options);
    }
}

const decoders = definePlainTextDecoders<TranslatedText>(translations => new TranslatedText(translations));

export const TranslatedTextDecoder = decoders.decoder;
export const TranslatedTextPatchDecoder = decoders.patchDecoder;
