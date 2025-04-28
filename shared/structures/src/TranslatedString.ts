import { Data, Decoder, Encodeable, EncodeContext, EnumDecoder, ObjectData, Patchable, PatchType, StringDecoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { Language } from './Language.js';

type LanguageMapPatch = {
    [key in Language]?: string | null;
};

const TranslationEncodeVersion = 370;

export class TranslatedStringPatch implements Encodeable, Patchable<TranslatedStringPatch> {
    /**
     * Setting to null will remove the translation (if it exists).
     */
    translations: LanguageMapPatch | string;

    constructor(translations: LanguageMapPatch | string) {
        this.translations = translations;
    }

    patch(patch: TranslatedStringPatch): this {
        if (typeof patch.translations === 'string') {
            return patch as this;
        }

        if (typeof this.translations === 'string' && Object.keys(patch.translations).length === 0) {
            // Ignore
            return this;
        }

        const c = typeof this.translations === 'string' ? new TranslatedStringPatch({}) as this : new TranslatedStringPatch({ ...this.translations }) as this;
        for (const key in patch.translations) {
            if (Object.prototype.hasOwnProperty.call(patch.translations, key)) {
                const value = patch.translations[key] as string | null;
                c.translations[key] = value;
            }
        }
        return c;
    }

    encode(context: EncodeContext) {
        if (typeof this.translations === 'string') {
            return this.translations;
        }
        return { ...this.translations, _isPatch: true };
    }
}

export class TranslatedString implements Encodeable, Patchable<TranslatedStringPatch>, StringLikeObject {
    translations: LanguageMap | string; // set to a string if not known in which language it is

    constructor(translations: LanguageMap | string = '') {
        this.translations = translations;
    }

    static create(translations: LanguageMap | string = '') {
        return new TranslatedString(translations);
    }

    get isDefault(): boolean {
        return typeof this.translations === 'string';
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

    patch(patch: string | LanguageMapPatch | TranslatedStringPatch | TranslatedString): this {
        if (typeof patch === 'string') {
            // Set to simple string without translations
            return TranslatedString.create(patch) as this;
        }

        if (patch instanceof TranslatedString) {
            return patch as this;
        }

        if (!(patch instanceof TranslatedStringPatch) && !(patch instanceof TranslatedString)) {
            return this.patch(TranslatedString.patch(patch));
        }

        if (typeof patch.translations === 'string') {
            // Set to simple string without translations
            return TranslatedString.create(patch.translations) as this;
        }

        if (typeof this.translations === 'string' && Object.keys(patch.translations).length === 0) {
            // Ignore
            return this;
        }

        const c = typeof this.translations === 'string' ? new TranslatedString({}) as this : new TranslatedString({ ...this.translations }) as this;
        for (const key in patch.translations) {
            if (key in patch.translations) {
                const value = patch.translations[key] as string | null;
                if (value === null) {
                    delete c.translations[key];
                }
                else {
                    c.translations[key] = value;
                }
            }
        }

        return c;
    }

    static patch(patch: LanguageMapPatch | string): PatchType<TranslatedString> {
        if (typeof patch === 'string') {
            return new TranslatedStringPatch({ [$getLanguage()]: patch });
        }

        return new TranslatedStringPatch(patch);
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

        if (this.translations[language] !== undefined) {
            return this.translations[language] as string;
        }
        return null;
    }

    get(language: Language): string {
        if (typeof this.translations === 'string') {
            return this.translations;
        }

        if (this.translations[language] !== undefined) {
            return this.translations[language] as string;
        }

        const keys = Object.keys(this.translations);
        if (keys.length === 0) {
            return '';
        }
        return this.translations[Language.English] ?? this.translations[Language.Dutch] ?? this.translations[keys[0]];
    }

    static field(options: { version?: number }) {
        return {
            ...options,
            decoder: TranslatedStringDecoder,
            upgrade: TranslatedString.upgrade,
            downgrade: TranslatedString.downgrade,
            upgradePatch: (str: PatchType<string>): PatchType<TranslatedString> => {
                if (!str || typeof str !== 'string') {
                    return new TranslatedStringPatch({});
                }
                return new TranslatedStringPatch({ [Language.Dutch]: str }); // Note: before the version we expect the string to be in Dutch
            },
            downgradePatch: (name: TranslatedStringPatch): PatchType<string> => {
                return name.translations[$getLanguage()] ?? name.translations[Language.English] ?? name.translations[Language.Dutch] ?? undefined;
            },
        };
    }

    static upgrade(data: any): TranslatedString {
        if (typeof data === 'string') {
            return new TranslatedString(data);
        }
        if (data instanceof TranslatedString) {
            return data;
        }
        console.warn('TranslatedString: Upgrading from unknown type', data);
        return new TranslatedString();
    }

    static downgrade(data: TranslatedString): string {
        return data.toString();
    }

    encode(context: EncodeContext) {
        const keys = Object.keys(this.translations);
        if (keys.length === 0) {
            return '';
        }
        if (keys.length === 1) {
            return this.translations[keys[0]];
        }
        return this.translations;
    }
}

export class TranslatedStringPatchDecoderStatic implements Decoder<PatchType<TranslatedString>> {
    decode(data: Data): PatchType<TranslatedString> {
        if (typeof data.value === 'string') {
            // Allowed
            return new TranslatedStringPatch(data.value);
        }

        if (typeof data.value !== 'object') {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Expected an object',
                field: data.currentField,
            });
        }

        const dictionary: PatchType<TranslatedString> = new TranslatedStringPatch({});
        for (const key in data.value) {
            if (Object.prototype.hasOwnProperty.call(data.value, key)) {
                if (key === '_isPatch') {
                    continue;
                }
                const language = new EnumDecoder(Language).decode(new ObjectData(key, data.context, data.addToCurrentField(key)));
                const str = data.field(key).nullable(StringDecoder);
                dictionary.translations[language] = str;
            }
        }

        return dictionary;
    }

    patchType() {
        return TranslatedStringPatchDecoder;
    }

    patchIdentifier(): Decoder<string | number> {
        throw new Error('A patched translated string can not be used inside a PatchableArray');
    }
}

export const TranslatedStringPatchDecoder = new TranslatedStringPatchDecoderStatic();

export class TranslatedStringDecoderStatic implements Decoder<TranslatedString> {
    patchType() {
        return TranslatedStringPatchDecoder;
    }

    patchIdentifier(): Decoder<string | number> {
        throw new Error('A translated string can not be used inside a PatchableArray');
    }

    decode(data: Data): TranslatedString {
        if (typeof data.value === 'string') {
            // Allowed
            return new TranslatedString(data.value);
        }

        if (typeof data.value !== 'object') {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Expected an object (preferred) or string',
                field: data.currentField,
            });
        }

        const dictionary: { [key in Language]?: string } = {};
        for (const key in data.value) {
            // eslint-disable-next-line no-prototype-builtins
            if (Object.prototype.hasOwnProperty.call(data.value, key)) {
                const language = new EnumDecoder(Language).decode(new ObjectData(key, data.context, data.addToCurrentField(key)));
                const str = data.field(key).string;
                dictionary[language] = str;
            }
        }

        return new TranslatedString(dictionary);
    }
}
export const TranslatedStringDecoder = new TranslatedStringDecoderStatic();
