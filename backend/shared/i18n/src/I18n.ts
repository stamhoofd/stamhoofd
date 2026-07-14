import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { logger, StyledText } from '@simonbackx/simple-logging';
import { countries, languages } from '@stamhoofd/locales';
import { appToUri } from '@stamhoofd/structures';
import { promises as fs } from 'fs';
import path from 'path';
import { Country } from '@stamhoofd/types/Country';
import { Language } from '@stamhoofd/types/Language';
import type { LocalizedDomain } from '@stamhoofd/types/Localized';
import { AsyncLocalStorage } from 'async_hooks';
import { createRequire } from 'node:module';

// Polyfill require.resolve, since import.meta.resolve is not supported by vitest
const require = createRequire(import.meta.url);

export class I18n {
    static loadedLocales: Map<string, Map<string, string>> = new Map();
    static defaultLanguage = Language.Dutch;
    static defaultCountry = Country.Belgium;

    /**
     * Temporary i18n override, scoped to an async execution context. When set, global $t
     * evaluation should prefer this over the request/context i18n. Used e.g. to render
     * order emails in the language of the customer instead of the current request language.
     */
    static overrideStorage = new AsyncLocalStorage<I18n>();

    static get override(): I18n | null {
        return this.overrideStorage.getStore() ?? null;
    }

    /**
     * Run a handler with a temporary i18n override. All global $t calls made during the
     * handler will use the given i18n instead of the current request/context one.
     */
    static runWithLocale<T>(i18n: I18n, handler: () => T): T {
        return this.overrideStorage.run(i18n, handler);
    }

    static async load() {
        await logger.setContext({
            prefixes: [
                new StyledText('[I18n] ').addClass('i18n', 'tag'),
            ],
            tags: ['i18n'],
        }, async () => {
            console.log('Loading locales...');

            if (!STAMHOOFD.translationNamespace) {
                throw new Error('STAMHOOFD.translationNamespace is not set');
            }

            const directory = path.dirname(require.resolve('@stamhoofd/locales/locales/' + STAMHOOFD.translationNamespace + '/nl-BE.json'));
            const files = (await fs.readdir(directory, { withFileTypes: true }))
                .filter(dirent => !dirent.isDirectory());

            for (const file of files) {
                const locale = file.name.substr(0, file.name.length - 5);

                const messages = await import(directory + '/' + file.name, { with: { type: 'json' } });
                this.loadedLocales.set(locale, this.loadRecursive(messages.default));
            }

            console.log('Loaded all locales');
        });
    }

    static loadRecursive(messages: any, prefix: string | null = null): Map<string, string> {
        const map = new Map();
        for (const key in messages) {
            const element = messages[key];
            if (typeof (element) !== 'string') {
                const map2 = this.loadRecursive(element, (prefix ? prefix + '.' : '') + key);
                map2.forEach((val, key) => map.set(key, val));
            } else {
                map.set((prefix ? prefix + '.' : '') + key, element);
            }
        }
        return map;
    }

    static get validLocales() {
        // todo: make platform specific
        return (STAMHOOFD.locales ?? {
            [Country.Belgium]: [Language.Dutch],
        }) as Partial<Record<Country, Language[]>>;
    }

    static isValidLocale(locale: string) {
        if (locale.length == 5 && locale.substr(2, 1) == '-') {
            const l = locale.substr(0, 2).toLowerCase() as Language;
            const c = locale.substr(3, 2).toUpperCase();

            if (languages.includes(l) && (countries as string[]).includes(c)) {
                return this.validLocales[c as Country]?.includes(l) ?? false;
            }
        }
        return false;
    }

    language = Language.Dutch;
    country = Country.Belgium;

    // Reference to messages in loadedLocales
    messages: Map<string, string>;

    get locale() {
        return this.language + '-' + this.country;
    }

    constructor(language: Language, country: Country) {
        this.language = language;
        this.country = country;
        this.correctLanguageCountryCombination();

        const m = I18n.loadedLocales.get(this.locale);
        if (!m) {
            if (STAMHOOFD.environment === 'test') {
                this.messages = new Map();
                return;
            }
            throw new Error('Locale not loaded when creating I18n for ' + language + '-' + country);
        }

        this.messages = m;
    }

    correctLanguageCountryCombination() {
        if (I18n.isValidLocale(this.locale)) {
            return;
        }
        const validLocales = I18n.validLocales;

        if (!(this.country in validLocales)) {
            // Find first coutnry with same language
            for (const country of countries) {
                if (validLocales[country]?.includes(this.language)) {
                    this.country = country;
                    return;
                }
            }

            // Fallback
            this.country = countries[0];
            this.language = validLocales[this.country]![0];
            return;
        }

        if (!validLocales[this.country]?.includes(this.language)) {
            if (validLocales[this.country]?.includes(Language.English)) {
                this.language = Language.English;
                return;
            }

            this.language = validLocales[this.country]![0];
        }
    }

    switchToLocale(options: {
        language?: Language;
        country?: Country;
    }) {
        this.country = options.country ?? this.country;
        this.language = options.language ?? this.language;
        this.correctLanguageCountryCombination();

        const m = I18n.loadedLocales.get(this.locale);
        if (!m) {
            if (STAMHOOFD.environment === 'test') {
                this.messages = new Map();
                return;
            }
            throw new Error('Locale not loaded, when switching to locale ' + this.language + '-' + this.country);
        }

        this.messages = m;
    }

    /**
     * Parse the locale (language + optional country) explicitly provided in the request
     * headers (X-Locale or Accept-Language). Returns nulls when nothing valid is present,
     * so callers can decide their own fallback. Country is only known for full 5-char locales.
     */
    private static localeFromRequestHeaders(request: Request | DecodedRequest<any, any, any>): { language: Language | null; country: Country | null } {
        // Try using custom property
        const localeHeader = request.headers['x-locale'];
        if (localeHeader && typeof localeHeader === 'string' && this.isValidLocale(localeHeader)) {
            return {
                language: localeHeader.substr(0, 2).toLowerCase() as Language,
                country: localeHeader.substr(3, 2).toUpperCase() as Country,
            };
        }

        // Try using accept-language defaults
        const acceptLanguage = request.headers['accept-language'];
        if (acceptLanguage) {
            const splitted = acceptLanguage.split(',');

            // Loop all countries and languages in the header, until we find a valid one
            for (const item of splitted) {
                const trimmed = item.trim();
                const localeSplit = trimmed.split(';');
                const locale = localeSplit[0];

                if (locale.length === 2 && languages.includes(locale as Language)) {
                    // Language only: the country can get overridden later when matching an organization
                    return { language: locale as Language, country: null };
                }

                if (locale.length === 5 && this.isValidLocale(locale)) {
                    return {
                        language: locale.substr(0, 2).toLowerCase() as Language,
                        country: locale.substr(3, 2).toUpperCase() as Country,
                    };
                }
            }
        }

        return { language: null, country: null };
    }

    /**
     * Determine the language explicitly provided in the request. Returns null when it can't be
     * determined, so callers can fall back to their own default (instead of the hardcoded default
     * language, which is what fromRequest(request).language would resolve to).
     */
    static getLanguageFromRequest(request: Request | DecodedRequest<any, any, any>): Language | null {
        return this.localeFromRequestHeaders(request).language;
    }

    static fromRequest(request: Request | DecodedRequest<any, any, any>): I18n {
        if ((request as any)._cached_i18n) {
            return (request as any)._cached_i18n;
        }

        const { language, country } = this.localeFromRequestHeaders(request);
        const i18n = new I18n(language ?? this.defaultLanguage, country ?? this.defaultCountry);
        (request as any)._cached_i18n = i18n;
        return i18n;
    }

    t(key: string, replace?: Record<string, string>) {
        return this.$t(key, replace);
    }

    $t(key: string, replace?: Record<string, string>) {
        return this.replace(this.messages.get(key) ?? key, replace);
    }

    escapeRegex(string) {
        return string.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    }

    replace(text: string, replace?: Record<string, string | { toString(): string }>) {
        if (!replace) {
            return text;
        }
        for (const key in replace) {
            const value = replace[key];
            text = text.replace(new RegExp('\\{' + this.escapeRegex(key) + '\\}', 'g'), value.toString());
        }
        return text;
    }

    getDomain(localizedDomain: LocalizedDomain): string {
        return localizedDomain[this.country] ?? localizedDomain[''];
    }

    localizedDomains = {
        adminUrl: () => 'https://' + STAMHOOFD.domains.dashboard + '/' + appToUri('admin'),
        dashboard: STAMHOOFD.domains.dashboard,
        marketing: (): string => this.getDomain(STAMHOOFD.domains.marketing),
        defaultTransactionalEmail: (): string => this.getDomain(STAMHOOFD.domains.defaultTransactionalEmail ?? { ['']: 'stamhoofd.be' }),
        defaultBroadcastEmail: (): string => this.getDomain(STAMHOOFD.domains.defaultBroadcastEmail ?? { ['']: 'stamhoofd.email' }),
    };
}
