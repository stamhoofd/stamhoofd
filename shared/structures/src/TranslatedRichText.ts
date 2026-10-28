import type { AutoEncoderPatchType, Data, Decoder, Encodeable, EncodeContext, Patchable, PlainObject } from '@common/encoding';
import { EnumDecoder, ObjectData } from '@common/encoding';
import { SimpleError } from '@common/errors';
import { Language } from '@stamhoofd/types/Language';
import { RichText } from './RichText.js';
import { TranslatedString } from './TranslatedString.js';

type RichTextLanguageMap = {
    [key in Language]?: RichText;
};

type RichTextLanguageMapPatch = {
    [key in Language]?: RichText | null;
};

/**
 * Changes individual languages of a TranslatedRichText, so concurrent edits of different languages
 * don't overwrite each other. Replacing the whole value is done by patching with a TranslatedRichText instead.
 */
export class TranslatedRichTextPatch implements Encodeable, Patchable<TranslatedRichTextPatch> {
    /**
     * Setting to null will remove the translation (if it exists).
     */
    translations: RichTextLanguageMapPatch;

    constructor(translations: RichTextLanguageMapPatch) {
        this.translations = translations;
    }

    patch(patch: TranslatedRichTextPatch | TranslatedRichText): this {
        if (patch instanceof TranslatedRichText) {
            return patch as unknown as this;
        }
        return new TranslatedRichTextPatch({ ...this.translations, ...patch.translations }) as this;
    }

    encode(context: EncodeContext) {
        const encoded: { [key: string]: PlainObject } = {};
        for (const key of Object.keys(this.translations) as Language[]) {
            const value = this.translations[key];
            if (value !== undefined) {
                encoded[key] = value === null ? null : value.encode(context);
            }
        }
        return { ...encoded, _isPatch: true };
    }
}

/**
 * RichText counterpart of TranslatedString. Stores a plain RichText when it is not known
 * in which language it was written, so existing RichText values can be upgraded without a migration.
 */
export class TranslatedRichText implements Encodeable, Patchable<TranslatedRichTextPatch | TranslatedRichText> {
    translations: RichTextLanguageMap | RichText;

    constructor(translations: RichTextLanguageMap | RichText = RichText.create({})) {
        this.translations = translations;
    }

    static create(translations: RichTextLanguageMap | RichText = RichText.create({})) {
        return new TranslatedRichText(translations);
    }

    get isDefault(): boolean {
        return this.translations instanceof RichText;
    }

    get languages(): Language[] {
        if (this.translations instanceof RichText) {
            return [];
        }
        return Object.keys(this.translations) as Language[];
    }

    getIfExists(language: Language): RichText | null {
        if (this.translations instanceof RichText) {
            return this.translations;
        }
        return this.translations[language] ?? null;
    }

    get(language: Language): RichText {
        if (this.translations instanceof RichText) {
            return this.translations;
        }

        if (this.translations[language] !== undefined) {
            return this.translations[language];
        }

        const keys = Object.keys(this.translations);
        if (keys.length === 0) {
            return RichText.create({});
        }
        return this.translations[Language.English] ?? this.translations[Language.Dutch] ?? this.translations[keys[0]];
    }

    toRichText(): RichText {
        return this.get($getLanguage());
    }

    get html(): string {
        return this.toRichText().html;
    }

    get text(): string {
        return this.toRichText().text;
    }

    toString() {
        return this.text;
    }

    /**
     * Audit logs show the text of every language, the same way as a TranslatedString
     */
    transformForDiff(): TranslatedString {
        if (this.translations instanceof RichText) {
            return new TranslatedString(this.translations.text);
        }
        const texts: { [key in Language]?: string } = {};
        for (const language of this.languages) {
            texts[language] = this.translations[language]!.text;
        }
        return new TranslatedString(texts);
    }

    patch(patch: TranslatedRichText | TranslatedRichTextPatch | RichText | RichTextLanguageMapPatch): this {
        if (patch instanceof TranslatedRichText) {
            return patch as this;
        }

        if (patch instanceof RichText) {
            // Set to rich text without translations
            return new TranslatedRichText(patch) as this;
        }

        const changes = patch instanceof TranslatedRichTextPatch ? patch.translations : patch;

        if (this.translations instanceof RichText && Object.keys(changes).length === 0) {
            return this;
        }

        const translations: RichTextLanguageMap = this.translations instanceof RichText ? {} : { ...this.translations };
        for (const key of Object.keys(changes) as Language[]) {
            const value = changes[key];
            if (value === null) {
                delete translations[key];
            } else if (value !== undefined) {
                translations[key] = value;
            }
        }
        return new TranslatedRichText(translations) as this;
    }

    /**
     * The patch that changes `from` into `to`, only containing the languages that were changed.
     * Switching between untranslated and translated content replaces the whole value.
     */
    static createPatch(from: TranslatedRichText, to: TranslatedRichText): TranslatedRichText | TranslatedRichTextPatch {
        if (from.translations instanceof RichText || to.translations instanceof RichText) {
            return to;
        }

        const changes: RichTextLanguageMapPatch = {};
        for (const language of to.languages) {
            const previous = from.getIfExists(language);
            const value = to.translations[language]!;
            if (!previous || previous.html !== value.html || previous.text !== value.text) {
                changes[language] = value;
            }
        }
        for (const language of from.languages) {
            if (!to.languages.includes(language)) {
                changes[language] = null;
            }
        }
        return new TranslatedRichTextPatch(changes);
    }

    clone(): TranslatedRichText {
        if (this.translations instanceof RichText) {
            return new TranslatedRichText(this.translations.clone());
        }
        const translations: RichTextLanguageMap = {};
        for (const language of this.languages) {
            translations[language] = this.translations[language]!.clone();
        }
        return new TranslatedRichText(translations);
    }

    encode(context: EncodeContext) {
        if (this.translations instanceof RichText) {
            return this.translations.encode(context);
        }
        const keys = this.languages;
        if (keys.length === 0) {
            return RichText.create({}).encode(context);
        }
        if (keys.length === 1) {
            return this.translations[keys[0]]!.encode(context);
        }
        const encoded: { [key: string]: PlainObject } = {};
        for (const key of keys) {
            encoded[key] = this.translations[key]!.encode(context);
        }
        return encoded;
    }

    /**
     * Use to change an existing RichText field into a TranslatedRichText field
     */
    static field(options: { version: number }) {
        return {
            ...options,
            decoder: TranslatedRichTextDecoder,
            upgrade: (old: RichText) => new TranslatedRichText(old),
            downgrade: (value: TranslatedRichText) => value.toRichText(),
            upgradePatch: (old: RichText | AutoEncoderPatchType<RichText> | undefined): TranslatedRichTextPatch | undefined => {
                if (!old) {
                    return undefined;
                }
                // Note: before the version we expect the rich text to be in Dutch
                if (old instanceof RichText) {
                    return new TranslatedRichTextPatch({ [Language.Dutch]: old });
                }
                if (old.html === undefined || old.text === undefined) {
                    return undefined;
                }
                return new TranslatedRichTextPatch({ [Language.Dutch]: RichText.create({ html: old.html, text: old.text }) });
            },
            downgradePatch: (value: TranslatedRichTextPatch | TranslatedRichText | undefined): RichText | undefined => {
                if (!value) {
                    return undefined;
                }
                if (value instanceof TranslatedRichText) {
                    return value.toRichText();
                }
                return value.translations[$getLanguage()] ?? value.translations[Language.English] ?? value.translations[Language.Dutch] ?? undefined;
            },
        };
    }
}

export class TranslatedRichTextPatchDecoderStatic implements Decoder<TranslatedRichTextPatch> {
    decode(data: Data): TranslatedRichTextPatch {
        if (typeof data.value !== 'object' || data.value === null) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Expected an object',
                field: data.currentField,
            });
        }

        const translations: RichTextLanguageMapPatch = {};
        for (const key of Object.keys(data.value as object)) {
            if (key === '_isPatch') {
                continue;
            }
            const language = new EnumDecoder(Language).decode(new ObjectData(key, data.context, data.addToCurrentField(key)));
            translations[language] = data.field(key).nullable(RichText as Decoder<RichText>);
        }
        return new TranslatedRichTextPatch(translations);
    }

    patchType() {
        return TranslatedRichTextPatchDecoder;
    }

    patchIdentifier(): Decoder<string | number> {
        throw new Error('A patched translated rich text can not be used inside a PatchableArray');
    }
}

export const TranslatedRichTextPatchDecoder = new TranslatedRichTextPatchDecoderStatic();

export class TranslatedRichTextDecoderStatic implements Decoder<TranslatedRichText> {
    decode(data: Data): TranslatedRichText {
        if (typeof data.value !== 'object' || data.value === null) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Expected an object',
                field: data.currentField,
            });
        }

        if ('html' in data.value || 'text' in data.value) {
            return new TranslatedRichText(data.decode(RichText as Decoder<RichText>));
        }

        const translations: RichTextLanguageMap = {};
        for (const key of Object.keys(data.value as object)) {
            const language = new EnumDecoder(Language).decode(new ObjectData(key, data.context, data.addToCurrentField(key)));
            translations[language] = data.field(key).decode(RichText as Decoder<RichText>);
        }
        return new TranslatedRichText(translations);
    }

    patchType() {
        return TranslatedRichTextPatchDecoder;
    }

    patchIdentifier(): Decoder<string | number> {
        throw new Error('A translated rich text can not be used inside a PatchableArray');
    }
}

export const TranslatedRichTextDecoder = new TranslatedRichTextDecoderStatic();
