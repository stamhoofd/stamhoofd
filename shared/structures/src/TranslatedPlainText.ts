import type { Data, Decoder, Encodeable, EncodeContext, Patchable } from '@common/encoding';
import { EnumDecoder, ObjectData, StringDecoder } from '@common/encoding';
import { SimpleError } from '@common/errors';
import type { StringLikeObject } from '@stamhoofd/utility/StringLikeObject.js';
import type { LanguageMap } from '@stamhoofd/types/LanguageMap';
import { Language } from '@stamhoofd/types/Language';

type LanguageMapPatch = {
    [key in Language]?: string | null;
};

/**
 * Plain text never contains a line break: that is what separates it from a TranslatedRichText, where a
 * line is markup instead of whitespace whose meaning depends on the CSS of the reader.
 */
function withoutLines(translations: LanguageMap | string): LanguageMap | string {
    if (typeof translations === 'string') {
        return translations.replaceAll('\n', ' ');
    }

    const result: LanguageMap = {};
    for (const key of Object.keys(translations) as Language[]) {
        const value = translations[key];
        if (value !== undefined) {
            result[key] = value.replaceAll('\n', ' ');
        }
    }
    return result;
}

/**
 * Patching one language at a time keeps concurrent edits of different languages from overwriting each
 * other. Replacing the whole value is done by patching with the value type instead.
 */
export class TranslatedPlainTextPatch implements Encodeable, Patchable<TranslatedPlainTextPatch> {
    /**
     * Setting to null will remove the translation (if it exists).
     */
    translations: LanguageMapPatch;

    constructor(translations: LanguageMapPatch) {
        const normalised: LanguageMapPatch = {};
        for (const key of Object.keys(translations) as Language[]) {
            const value = translations[key];
            if (value !== undefined) {
                // null removes the translation, so it is kept as is
                normalised[key] = value === null ? null : value.replaceAll('\n', ' ');
            }
        }
        this.translations = normalised;
    }

    patch(patch: TranslatedPlainTextPatch): this {
        return new TranslatedPlainTextPatch({ ...this.translations, ...patch.translations }) as this;
    }

    encode(_context: EncodeContext) {
        return { ...this.translations, _isPatch: true };
    }
}

/**
 * The encoding is identical to the deprecated TranslatedString, so converting a field does not change
 * its wire format. The two subclasses differ only in their display contract, which is why they are
 * separate classes at all: the type of a field decides both its input and its view.
 */
export abstract class TranslatedPlainText implements Encodeable, Patchable<TranslatedPlainTextPatch>, StringLikeObject {
    translations: LanguageMap | string; // set to a string if not known in which language it is

    constructor(translations: LanguageMap | string = '') {
        this.translations = withoutLines(translations);
    }

    /**
     * Public on purpose: a protected member makes the class nominal, and the reactive() copy that the
     * inputs create is then no longer assignable.
     */
    build(translations: LanguageMap | string): this {
        return new (this.constructor as new (translations: LanguageMap | string) => this)(translations);
    }

    get isDefault(): boolean {
        return typeof this.translations === 'string';
    }

    get languages(): Language[] {
        if (typeof this.translations === 'string') {
            return [];
        }
        return Object.keys(this.translations) as Language[];
    }

    getIfExists(language: Language): string | null {
        if (typeof this.translations === 'string') {
            return this.translations;
        }
        return this.translations[language] ?? null;
    }

    get(language: Language): string {
        if (typeof this.translations === 'string') {
            return this.translations;
        }

        if (this.translations[language] !== undefined) {
            return this.translations[language] as string;
        }

        const keys = Object.keys(this.translations) as Language[];
        if (keys.length === 0) {
            return '';
        }
        return this.translations[Language.English] ?? this.translations[Language.Dutch] ?? this.translations[keys[0]] as string;
    }

    fallback(str: string) {
        if (this.length === 0) {
            return str;
        }
        return this.toString();
    }

    get length(): number {
        return this.toString().length;
    }

    toString() {
        return this.get($getLanguage());
    }

    valueOf() {
        return this.toString();
    }

    trim() {
        return this.toString().trim();
    }

    toLowerCase() {
        return this.toString().toLowerCase();
    }

    toUpperCase() {
        return this.toString().toUpperCase();
    }

    toLocaleLowerCase() {
        return this.toString().toLocaleLowerCase();
    }

    toLocaleUpperCase() {
        return this.toString().toLocaleUpperCase();
    }

    substr(start: number, length?: number) {
        return this.toString().substr(start, length);
    }

    substring(start: number, end?: number) {
        return this.toString().substring(start, end);
    }

    normalize(form?: string) {
        return this.toString().normalize(form);
    }

    replace(searchValue: string | RegExp, replaceValue: string) {
        return this.toString().replace(searchValue, replaceValue);
    }

    charAt(index: number) {
        return this.toString().charAt(index);
    }

    slice(start: number, end?: number) {
        return this.toString().slice(start, end);
    }

    split(separator: string | RegExp, limit?: number): string[] {
        return this.toString().split(separator, limit);
    }

    startsWith(searchString: string, position?: number) {
        return this.toString().startsWith(searchString, position);
    }

    match(regexp: string | RegExp) {
        return this.toString().match(regexp);
    }

    patch(patch: string | LanguageMapPatch | TranslatedPlainTextPatch | TranslatedPlainText): this {
        if (typeof patch === 'string') {
            // Set to a simple string without translations
            return this.build(patch);
        }

        if (patch instanceof TranslatedPlainText) {
            return patch as this;
        }

        const changes = patch instanceof TranslatedPlainTextPatch ? patch.translations : patch;

        if (typeof this.translations === 'string' && Object.keys(changes).length === 0) {
            // Ignore
            return this;
        }

        const translations: LanguageMap = typeof this.translations === 'string' ? {} : { ...this.translations };
        for (const key of Object.keys(changes) as Language[]) {
            const value = changes[key];
            if (value === null) {
                delete translations[key];
            }
            else if (value !== undefined) {
                translations[key] = value;
            }
        }
        return this.build(translations);
    }

    /**
     * Public for the same reason as build()
     */
    _append(str: string | TranslatedPlainText): this {
        if (typeof str === 'string') {
            return this._append(this.build(str));
        }

        const duplicate = this.clone();
        if (typeof duplicate.translations !== 'string') {
            for (const key of Object.keys(duplicate.translations) as Language[]) {
                duplicate.translations[key] = (duplicate.translations[key] ?? '') + str.get(key);
            }
            return duplicate;
        }

        duplicate.translations = duplicate.translations + str.toString();
        return duplicate;
    }

    append(...str: (string | TranslatedPlainText)[]): this {
        let duplicate = this;
        for (const s of str) {
            duplicate = duplicate._append(s);
        }
        return duplicate;
    }

    clone(): this {
        return this.build(typeof this.translations === 'string' ? this.translations : { ...this.translations });
    }

    /**
     * Encodes exactly like a TranslatedString, so a converted field keeps its wire format
     */
    encode(_context: EncodeContext) {
        if (typeof this.translations === 'string') {
            return this.translations;
        }
        const keys = Object.keys(this.translations) as Language[];
        if (keys.length === 0) {
            return '';
        }
        if (keys.length === 1) {
            return this.translations[keys[0]] as string;
        }
        return { ...this.translations };
    }
}

/**
 * Each type gets its own set, so a field declares which of the two it is
 */
export function definePlainTextDecoders<T extends TranslatedPlainText>(construct: (translations: LanguageMap | string) => T) {
    const patchDecoder: Decoder<TranslatedPlainTextPatch> & { patchType: () => Decoder<TranslatedPlainTextPatch>; patchIdentifier: () => Decoder<string | number> } = {
        decode(data: Data): TranslatedPlainTextPatch {
            if (typeof data.value !== 'object' || data.value === null) {
                throw new SimpleError({
                    code: 'invalid_field',
                    message: 'Expected an object',
                    field: data.currentField,
                });
            }

            const translations: LanguageMapPatch = {};
            for (const key of Object.keys(data.value as object)) {
                if (key === '_isPatch') {
                    continue;
                }
                const language = new EnumDecoder(Language).decode(new ObjectData(key, data.context, data.addToCurrentField(key)));
                translations[language] = data.field(key).nullable(StringDecoder);
            }
            return new TranslatedPlainTextPatch(translations);
        },
        patchType: () => patchDecoder,
        patchIdentifier: () => {
            throw new Error('A patched translated text can not be used inside a PatchableArray');
        },
    };

    const decoder: Decoder<T> & { patchType: () => Decoder<TranslatedPlainTextPatch>; patchIdentifier: () => Decoder<string | number> } = {
        decode(data: Data): T {
            if (typeof data.value === 'string') {
                // Allowed: stored before the field was translatable
                return construct(data.value);
            }

            if (typeof data.value !== 'object' || data.value === null) {
                throw new SimpleError({
                    code: 'invalid_field',
                    message: 'Expected an object (preferred) or string',
                    field: data.currentField,
                });
            }

            const translations: LanguageMap = {};
            for (const key of Object.keys(data.value as object)) {
                const language = new EnumDecoder(Language).decode(new ObjectData(key, data.context, data.addToCurrentField(key)));
                translations[language] = data.field(key).string;
            }
            return construct(translations);
        },
        patchType: () => patchDecoder,
        patchIdentifier: () => {
            throw new Error('A translated text can not be used inside a PatchableArray');
        },
    };

    function field(options: { version?: number; nullable?: boolean; optional?: boolean; defaultValue?: () => T; isDefaultValue?: (v: T | undefined | null) => boolean } = {}) {
        return {
            ...options,
            decoder,
            upgrade: (old: string | { translations: LanguageMap | string } | null | undefined): T | null | undefined => {
                if (old === null || old === undefined) {
                    return old;
                }
                if (typeof old === 'string') {
                    return construct(old);
                }
                return construct(old.translations);
            },
            downgrade: (value: T | null | undefined): string | null | undefined => {
                if (value === null || value === undefined) {
                    return value;
                }
                return value.toString();
            },
            upgradePatch: (old: string | { translations: LanguageMapPatch | LanguageMap | string } | null | undefined): TranslatedPlainTextPatch | T | null | undefined => {
                if (old === null || old === undefined) {
                    return old;
                }
                if (typeof old === 'string') {
                    // Note: before the version we expect the string to be in Dutch
                    return new TranslatedPlainTextPatch({ [Language.Dutch]: old });
                }
                if (typeof old.translations === 'string') {
                    // An older client that replaced the whole value with an untranslated string
                    return construct(old.translations);
                }
                return new TranslatedPlainTextPatch(old.translations as LanguageMapPatch);
            },
            downgradePatch: (value: TranslatedPlainTextPatch | T | null | undefined): string | null | undefined => {
                if (value === null || value === undefined) {
                    return value;
                }
                if (value instanceof TranslatedPlainText) {
                    return value.toString();
                }
                return value.translations[$getLanguage()] ?? value.translations[Language.English] ?? value.translations[Language.Dutch] ?? undefined;
            },
        };
    }

    return { decoder, patchDecoder, field };
}
