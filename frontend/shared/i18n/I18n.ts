import type { CountryCode } from '@stamhoofd/types/Country';
import { Country } from '@stamhoofd/types/Country';
import { Formatter } from '@stamhoofd/utility';
import type { App } from 'vue';

export class I18n {
    loadedLocales: Map<string, Map<string, string>> = new Map();
    loadedNamespaces: Set<string> = new Set();
    locale = 'nl-BE';
    language: string = 'nl';
    country: CountryCode = Country.Belgium;
    _debug = false;

    // Reference to messages in loadedLocales
    messages: Map<string, string>;

    install(app: App) {
        (app.config.globalProperties as any).$t = this.$t.bind(this);
    }

    get debug() {
        return this._debug && STAMHOOFD.environment === 'development';
    }

    loadRecursive(messages: any, prefix: string | null = null): Map<string, string> {
        const map = new Map();
        for (const key in messages) {
            const element = messages[key];
            if (typeof (element) !== 'string') {
                const map2 = this.loadRecursive(element, (prefix ? prefix + '.' : '') + key);
                map2.forEach((val, key) => map.set(key, val));
            }
            else {
                map.set((prefix ? prefix + '.' : '') + key, element);
            }
        }
        return map;
    }

    setLocale(locale: string, language: string, country: CountryCode) {
        this.language = language;
        this.country = country;
        this.locale = locale;
        const messages = this.loadedLocales.get(locale);
        if (!messages) {
            throw new Error('Locale not loaded when creating I18n for ' + locale);
        }
        this.messages = messages;
    }

    isLocaleLoaded(namespace: string, locale: string) {
        return this.loadedNamespaces.has(namespace + ':' + locale);
    }

    /**
     * Evaluate a callback with $t and $getLanguage bound to another (already loaded) locale,
     * without switching the app locale. Used e.g. to generate the example replacement values
     * of an email in the language that is being edited instead of the interface language.
     * The country is left unchanged: only the messages and language are swapped.
     */
    runWithLocale<T>(locale: string, fn: () => T): T {
        const messages = this.loadedLocales.get(locale);
        if (!messages || locale === this.locale) {
            return fn();
        }
        const previous = { locale: this.locale, language: this.language, messages: this.messages };
        this.locale = locale;
        this.language = locale.substring(0, 2);
        this.messages = messages;
        try {
            return fn();
        }
        finally {
            this.locale = previous.locale;
            this.language = previous.language;
            this.messages = previous.messages;
        }
    }

    loadLocale(namespace: string, locale: string, messages: any) {
        this.loadedNamespaces.add(namespace + ':' + locale);
        const loaded = this.loadRecursive(messages);
        const existing = this.loadedLocales.get(locale);

        // Merge maps
        if (existing) {
            loaded.forEach((val, key) => existing.set(key, val));
        }
        else {
            this.loadedLocales.set(locale, loaded);
        }
    }

    t(key: string, replace?: Record<string, string>): string {
        return this.$t(key, replace);
    }

    $t(key: string, replace?: Record<string, string | { toString(): string }>): string {
        return this.replace(this.get(key) + (this.debug ? (' (' + this.locale + ')') : ''), replace);
    }

    get(key: string): string {
        return this.messages?.get(key) ?? key;
    }

    replace(text: string, replace?: Record<string, string | { toString(): string }>): string {
        if (!replace) {
            return text;
        }
        for (const key in replace) {
            const value = replace[key];
            text = text.replace(new RegExp('\\{' + Formatter.escapeRegex(key) + '\\}', 'g'), value.toString());
        }
        return text;
    }
}
