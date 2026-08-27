import type { Data, Decoder } from '@simonbackx/simple-encoding';
import { ArrayDecoder, AutoEncoder, EnumDecoder, field, MapDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { Language } from '@stamhoofd/types/Language';

/**
 * A plain string, or a TipTap document (the JSON output of the editor).
 */
export type TranslatableValue = string | TipTapDocument;

export type TipTapDocument = {
    type: string;
    [key: string]: unknown;
};

export function isTipTapDocument(value: unknown): value is TipTapDocument {
    return typeof value === 'object' && value !== null && !Array.isArray(value) && typeof (value as { type?: unknown }).type === 'string';
}

class TranslatableValueDecoder implements Decoder<TranslatableValue> {
    decode(data: Data): TranslatableValue {
        const value = data.value as unknown;
        if (typeof value === 'string') {
            return value;
        }
        if (isTipTapDocument(value)) {
            return value;
        }
        throw new SimpleError({
            code: 'invalid_field',
            message: 'Expected a string or a TipTap document (object with a type)',
            field: data.currentField,
        });
    }
}

/**
 * Request to translate one or more values at once. Values are keyed (e.g. { name, description })
 * so the model sees related content together, and the response uses the same keys.
 */
export class TranslateRequest extends AutoEncoder {
    @field({ decoder: new MapDecoder(StringDecoder, new TranslatableValueDecoder()) })
    inputs: Map<string, TranslatableValue> = new Map();

    /**
     * Language of the inputs. null lets the model detect it.
     */
    @field({ decoder: new EnumDecoder(Language), nullable: true })
    sourceLanguage: Language | null = null;

    @field({ decoder: new ArrayDecoder(new EnumDecoder(Language)) })
    targetLanguages: Language[] = [];

    /**
     * Extra requirements for the translation (tone, terminology, ...), passed to the model as-is.
     */
    @field({ decoder: StringDecoder, nullable: true })
    context: string | null = null;
}

export class TranslateResponse extends AutoEncoder {
    /**
     * Per target language: the translated values, using the same keys as the request inputs.
     */
    @field({ decoder: new MapDecoder(new EnumDecoder(Language), new MapDecoder(StringDecoder, new TranslatableValueDecoder())) })
    translations: Map<Language, Map<string, TranslatableValue>> = new Map();
}
