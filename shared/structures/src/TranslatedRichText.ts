import type { AutoEncoderPatchType, Data, Decoder, Encodeable, EncodeContext, Patchable, PlainObject } from '@common/encoding';
import { EnumDecoder, ObjectData } from '@common/encoding';
import { SimpleError } from '@common/errors';
import { Language } from '@stamhoofd/types/Language';
import { RichText } from './RichText.js';
import { TranslatedString, TranslatedStringPatch } from './TranslatedString.js';

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

    /**
     * Every line becomes a paragraph
     */
    static fromText(text: string): TranslatedRichText {
        return new TranslatedRichText(RichText.fromText(text));
    }

    /**
     * Converts every language of a translated string into a rich text, keeping an untranslated value untranslated
     */
    static fromTranslatedString(value: TranslatedString): TranslatedRichText {
        if (value.isDefault || value.languages.length === 0) {
            return TranslatedRichText.create(RichText.fromText(value.toString()));
        }

        const translations: RichTextLanguageMap = {};
        for (const language of value.languages) {
            translations[language] = RichText.fromText(value.get(language));
        }
        return TranslatedRichText.create(translations);
    }

    get isDefault(): boolean {
        return this.translations instanceof RichText;
    }

    get languages(): Language[] {
        if (this.translations instanceof RichText) {
            return [];
        }
        const translations = this.translations;
        return (Object.keys(translations) as Language[]).filter(language => translations[language] !== undefined);
    }

    /**
     * Languages to try, in order, when a translation is requested
     */
    private static fallbackLanguages(language: Language): Language[] {
        return [language, Language.English, Language.Dutch];
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

        for (const fallback of TranslatedRichText.fallbackLanguages(language)) {
            const value = this.translations[fallback];
            if (value !== undefined) {
                return value;
            }
        }

        const keys = this.languages;
        if (keys.length === 0) {
            return RichText.create({});
        }
        return this.translations[keys[0]]!;
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
     * Loses the markup, so only for readers that cannot handle it: audit logs and clients from before
     * the field became rich text.
     */
    toTranslatedString(): TranslatedString {
        if (this.translations instanceof RichText) {
            return new TranslatedString(this.translations.text);
        }
        const texts: { [key in Language]?: string } = {};
        for (const language of this.languages) {
            texts[language] = this.translations[language]!.text;
        }
        return new TranslatedString(texts);
    }

    /**
     * Audit logs show the text of every language, the same way as a TranslatedString
     */
    transformForDiff(): TranslatedString {
        return this.toTranslatedString();
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

        if (Object.keys(translations).length === 0) {
            // Removing the last language (e.g. two users each removing a different one) leaves nothing to translate
            return this.translations instanceof RichText ? this : new TranslatedRichText() as this;
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

    /**
     * An untranslated value is encoded as a plain RichText, a translated value as an object keyed by language.
     * Unlike TranslatedString, a single language is not collapsed to a plain RichText: that would turn it
     * into an untranslated value after a round trip, and a later language patch would then discard it.
     */
    encode(context: EncodeContext) {
        if (this.translations instanceof RichText) {
            return this.translations.encode(context);
        }
        const encoded: { [key: string]: PlainObject } = {};
        for (const key of this.languages) {
            encoded[key] = this.translations[key]!.encode(context);
        }
        return encoded;
    }

    /**
     * Use to change an existing RichText field into a TranslatedRichText field
     */
    static field(options: { version: number; nullable?: boolean; optional?: boolean; defaultValue?: () => TranslatedRichText | null }) {
        return {
            ...options,
            decoder: TranslatedRichTextDecoder,
            upgrade: (old: RichText | null | undefined): TranslatedRichText | null | undefined => {
                if (old === null || old === undefined) {
                    return old;
                }
                return new TranslatedRichText(old);
            },
            downgrade: (value: TranslatedRichText | null | undefined): RichText | null | undefined => {
                if (value === null || value === undefined) {
                    return value;
                }
                return value.toRichText();
            },
            upgradePatch: (old: RichText | AutoEncoderPatchType<RichText> | null | undefined): TranslatedRichTextPatch | null | undefined => {
                if (old === null || old === undefined) {
                    return old;
                }
                // Note: before the version we expect the rich text to be in Dutch
                if (old instanceof RichText) {
                    return new TranslatedRichTextPatch({ [Language.Dutch]: old });
                }
                if (old.html === undefined || old.text === undefined) {
                    throw new SimpleError({
                        code: 'invalid_field',
                        message: 'A rich text patch must contain both html and text',
                        human: $t('Deze wijziging wordt niet ondersteund. Werk de app bij en probeer opnieuw.'),
                    });
                }
                return new TranslatedRichTextPatch({ [Language.Dutch]: RichText.create({ html: old.html, text: old.text }) });
            },
            /**
             * Only the patched languages are known here, so a patch that does not touch the languages
             * an old client can display is sent as 'no change'. Old clients keep the previous text in that case.
             */
            downgradePatch: (value: TranslatedRichTextPatch | TranslatedRichText | null | undefined): RichText | null | undefined => {
                if (value === null || value === undefined) {
                    return value;
                }
                if (value instanceof TranslatedRichText) {
                    return value.toRichText();
                }
                return TranslatedRichText.downgradeLanguagePatch(value);
            },
        };
    }

    /**
     * Undefined when the patch touches no language an old client can display: it then keeps its previous text.
     */
    private static downgradeLanguagePatch(value: TranslatedRichTextPatch): RichText | undefined {
        for (const language of TranslatedRichText.fallbackLanguages($getLanguage())) {
            const richText = value.translations[language];
            if (richText) {
                return richText;
            }
        }
        return undefined;
    }

    /**
     * Every language keeps its own text and its line breaks become paragraphs, so nothing is lost for
     * a field that was already translated.
     */
    static translatedStringField(options: { version: number; nullable?: boolean; optional?: boolean; defaultValue?: () => TranslatedRichText | null }) {
        return {
            ...options,
            decoder: TranslatedRichTextDecoder,
            upgrade: (old: TranslatedString | null | undefined): TranslatedRichText | null | undefined => {
                if (old === null || old === undefined) {
                    return old;
                }
                return TranslatedRichText.fromTranslatedString(old);
            },
            downgrade: (value: TranslatedRichText | null | undefined): TranslatedString | null | undefined => {
                if (value === null || value === undefined) {
                    return value;
                }
                return value.toTranslatedString();
            },
            upgradePatch: (old: TranslatedStringPatch | TranslatedString | null | undefined): TranslatedRichText | TranslatedRichTextPatch | null | undefined => {
                if (old === null || old === undefined) {
                    return old;
                }
                if (old instanceof TranslatedString) {
                    return TranslatedRichText.fromTranslatedString(old);
                }
                if (typeof old.translations === 'string') {
                    // An old client that replaced the whole value with an untranslated string
                    return TranslatedRichText.create(RichText.fromText(old.translations));
                }
                const translations: RichTextLanguageMapPatch = {};
                for (const language of Object.keys(old.translations) as Language[]) {
                    const text = old.translations[language];
                    if (text === undefined) {
                        continue;
                    }
                    translations[language] = text === null ? null : RichText.fromText(text);
                }
                return new TranslatedRichTextPatch(translations);
            },
            downgradePatch: (value: TranslatedRichTextPatch | TranslatedRichText | null | undefined): TranslatedStringPatch | TranslatedString | null | undefined => {
                if (value === null || value === undefined) {
                    return value;
                }
                if (value instanceof TranslatedRichText) {
                    return value.toTranslatedString();
                }
                const translations: { [key in Language]?: string | null } = {};
                for (const language of Object.keys(value.translations) as Language[]) {
                    const richText = value.translations[language];
                    if (richText === undefined) {
                        continue;
                    }
                    translations[language] = richText === null ? null : richText.text;
                }
                return new TranslatedStringPatch(translations);
            },
        };
    }

    /**
     * A stored line break becomes a paragraph, so text that was typed with Enter keeps its layout
     * instead of depending on the pre-wrap of each individual reader.
     */
    static stringField(options: { version: number; nullable?: boolean; optional?: boolean; defaultValue?: () => TranslatedRichText | null }) {
        return {
            ...options,
            decoder: TranslatedRichTextDecoder,
            upgrade: (old: string | null | undefined): TranslatedRichText | null | undefined => {
                if (old === null || old === undefined) {
                    return old;
                }
                return new TranslatedRichText(RichText.fromText(old));
            },
            downgrade: (value: TranslatedRichText | null | undefined): string | null | undefined => {
                if (value === null || value === undefined) {
                    return value;
                }
                return value.text;
            },
            upgradePatch: (old: string | null | undefined): TranslatedRichTextPatch | null | undefined => {
                if (old === null || old === undefined) {
                    return old;
                }
                // Note: before the version we expect the text to be in Dutch
                return new TranslatedRichTextPatch({ [Language.Dutch]: RichText.fromText(old) });
            },
            downgradePatch: (value: TranslatedRichTextPatch | TranslatedRichText | null | undefined): string | null | undefined => {
                if (value === null || value === undefined) {
                    return value;
                }
                if (value instanceof TranslatedRichText) {
                    return value.text;
                }
                return TranslatedRichText.downgradeLanguagePatch(value)?.text;
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
    /**
     * Rows in a json column are decoded at the current version, so they never pass through the upgrade
     * of a field: a field that used to hold plain text has to stay readable here.
     */
    private decodeValue(data: Data): RichText {
        if (typeof data.value === 'string') {
            return RichText.fromText(data.value);
        }
        return data.decode(RichText as Decoder<RichText>);
    }

    decode(data: Data): TranslatedRichText {
        if (typeof data.value === 'string') {
            return new TranslatedRichText(RichText.fromText(data.value));
        }

        if (typeof data.value !== 'object' || data.value === null) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Expected an object or string',
                field: data.currentField,
            });
        }

        if ('html' in data.value || 'text' in data.value) {
            return new TranslatedRichText(data.decode(RichText as Decoder<RichText>));
        }

        const translations: RichTextLanguageMap = {};
        for (const key of Object.keys(data.value as object)) {
            const language = new EnumDecoder(Language).decode(new ObjectData(key, data.context, data.addToCurrentField(key)));
            translations[language] = this.decodeValue(data.field(key));
        }
        if (Object.keys(translations).length === 0) {
            // Stored before patches normalised an emptied language map
            return new TranslatedRichText();
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
