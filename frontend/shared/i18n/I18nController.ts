// i18n-setup.js
import { HistoryManager } from '@simonbackx/vue-app-navigation';
import { countries, languages } from '@stamhoofd/locales';
import { SessionContext, Storage, UrlHelper } from '@stamhoofd/networking';
import { Address, Country, CountryCode, countryToCode, Language } from '@stamhoofd/structures';
import { I18n } from './I18n';

export function useTranslate(): typeof I18n.prototype.$t {
    const i18n = I18nController.getI18n();
    return i18n ? i18n.$t.bind(i18n) : k => 'i18n missing';
}

function setGlobalTranslateFunction(i18n: I18n) {
    if (i18n) {
        (window as any).$t = (key: string, replace?: Record<string, string>) => i18n.$t.bind(i18n)(key, replace);
        (window as any).$getLanguage = () => i18n.language;
        (window as any).$getCountry = () => i18n.country;
        return;
    }

    (window as any).$t = (_key: string, _replace?: Record<string, string>) => 'i18n missing';
    return;
}

export class I18nController {
    static i18n: I18n = import.meta.hot?.data?.i18n ?? undefined;
    static shared: I18nController = import.meta.hot?.data?.shared ?? undefined;
    static addUrlPrefix = true;
    static skipUrlPrefixForLocale?: string;

    /**
     * Whether only one country is enabled for the whole domain
     * -> use for webshops and registration pages
     * -> affects the generated SEO meta tags
     */
    static fixedCountry = false;

    namespace = '';
    language = Language.Dutch;
    countryCode: CountryCode = Country.Belgium;

    // Used for SEO
    defaultCountryCode: CountryCode = Country.Belgium;
    defaultLanguage = Language.Dutch;

    // Allows you to set and remove meta data
    // vueMetaApp?: VueMetaApp

    $context: SessionContext | null | undefined;

    get locale() {
        return this.language + '-' + this.countryCode;
    }

    constructor($context: SessionContext | undefined | null, language: Language, country: Country, namespace: string) {
        this.$context = $context;
        this.namespace = namespace;
        this.language = language;
        this.setCountryCode(country);
        this.correctLocale();
        // app.config.globalProperties.$country = this.country
    }

    private setCountryCode(country: Country) {
        this.countryCode = countryToCode({ country, defaultCountryCode: this.defaultCountryCode });
    }

    static getI18n(): I18n {
        if (this.i18n) {
            return this.i18n;
        }
        const i18n = new I18n();
        setGlobalTranslateFunction(i18n);
        this.i18n = i18n;

        if (import.meta.hot) {
            import.meta.hot.data.i18n = this.i18n;
        }
        return this.i18n;
    }

    async switchToLocale(options: {
        language?: Language;
        country?: Country;
    }) {
        if ((options.country ?? this.countryCode) == this.countryCode && (options.language ?? this.language) == this.language) {
            return;
        }
        this.setCountryCode(options.country ?? this.countryCode);
        this.language = options.language ?? this.language;
        this.correctLocale();

        // Update url's
        await Promise.all([
            this.updateUrl(),
            this.loadLocale(),
        ]);

        this.saveLocaleToStorage().catch(console.error);
    }

    transformUrlForLocale(url: string, language: string, country: string, addPrefix = true) {
        const prefix = UrlHelper.fixedPrefix && addPrefix ? '/' + UrlHelper.fixedPrefix : '';
        const locale = language + '-' + country;
        if (I18nController.shared && I18nController.addUrlPrefix && (I18nController.skipUrlPrefixForLocale === undefined || I18nController.skipUrlPrefixForLocale !== locale)) {
            if (I18nController.fixedCountry || STAMHOOFD.fixedCountry) {
                return '/' + language + prefix + url;
            }
            else {
                return '/' + language + '-' + country + prefix + url;
            }
        }
        else {
            return prefix + url;
        }
    }

    async updateUrl() {
        if (I18nController.shared && I18nController.addUrlPrefix && (I18nController.skipUrlPrefixForLocale === undefined || I18nController.skipUrlPrefixForLocale !== I18nController.shared.locale)) {
            if (I18nController.fixedCountry || STAMHOOFD.fixedCountry) {
                UrlHelper.localePrefix = I18nController.shared.language;
            }
            else {
                UrlHelper.localePrefix = I18nController.shared.locale;
            }
        }
        else {
            UrlHelper.localePrefix = '';
        }
        await HistoryManager.updateUrl();
    }

    get validLocales() {
        // todo: make platform specific
        return (STAMHOOFD.locales ?? {
            [Country.Belgium]: [Language.Dutch, Language.English],
            [Country.Netherlands]: [Language.Dutch, Language.English],
        }) as Partial<Record<Country, Language[]>>;
    }

    get availableLanguages(): Language[] {
        return this.validLocales[this.countryCode] ?? [];
    }

    correctLocale() {
        // Some locales are invalid
        const validLocales = this.validLocales;

        if (!(this.countryCode in validLocales)) {
            // Find first coutnry with same language
            for (const country of countries) {
                if (validLocales[country]?.includes(this.language)) {
                    this.setCountryCode(country);
                    console.info('[I18n] Corrected country to ' + country);
                    return;
                }
            }

            // Fallback
            this.setCountryCode(countries[0]);
            this.language = validLocales[this.countryCode]![0];
            console.info('[I18n] Corrected country to ' + this.countryCode + ' and language to ' + this.language);
            return;
        }

        if (!validLocales[this.countryCode]?.includes(this.language)) {
            if (validLocales[this.countryCode]?.includes(Language.English)) {
                this.language = Language.English;
                console.info('[I18n] Corrected language to en');
                return;
            }

            this.language = validLocales[this.countryCode]![0];
            console.info('[I18n] Corrected language to ' + this.language);
        }
    }

    async loadLocale() {
        // app.config.globalProperties.$country = this.country

        const locale = this.locale;
        console.info('[I18n] Loading locale ' + locale);
        // If the same language

        const i18n = I18nController.getI18n();
        const namespace = this.namespace;

        if (!i18n.isLocaleLoaded(namespace, locale)) {
            // If the language hasn't been loaded yet
            const messages = await import(`../../../shared/locales/dist/${namespace}/${locale}.json`);
            i18n.loadLocale(namespace, locale, messages.default);
            console.log('[I18n] Successfully loaded locale', namespace, locale);
        }

        i18n.setLocale(locale, this.language, this.countryCode);
    }

    static async getLocaleFromStorage(): Promise<{ language?: Language; country?: Country }> {
        const country = await Storage.keyValue.getItem('country');
        const language = await Storage.keyValue.getItem('language');

        return {
            country: country && this.isValidCountry(country) ? country : undefined,
            language: language && this.isValidLanguage(language) ? language : undefined,
        };
    }

    async saveLocaleToStorage() {
        await Storage.keyValue.setItem('language', this.language);
        await Storage.keyValue.setItem('country', this.countryCode);

        console.info('[I18n] Saved locale to storage', this.locale);
    }

    static isValidLocale(locale: string) {
        if (locale.length == 5 && locale.substr(2, 1) == '-') {
            const l = locale.substr(0, 2).toLowerCase();
            const c = locale.substr(3, 2).toUpperCase();

            return this.isValidLanguage(l) && this.isValidCountry(c);
        }
        return false;
    }

    static isValidLanguage(language: string): language is Language {
        return languages.includes(language as Language);
    }

    static isValidCountry(country: string): country is Country {
        return STAMHOOFD.fixedCountry ? ((country as any) === STAMHOOFD.fixedCountry) : countries.includes(country as Country);
    }

    static async loadDefault($context: SessionContext | null | undefined, defaultCountry?: Country, defaultLanguage?: Language, country?: Country) {
        const namespace = STAMHOOFD.translationNamespace;
        let language: Language | undefined = undefined;
        let needsSave = false;

        // Check country if passed
        if (country && !this.isValidCountry(country)) {
            console.error('[I18n] Invalid forced country', country);
            country = undefined;
        }

        // 1. Get by storage (always preferred)
        const isPrerender = navigator.userAgent.toLowerCase().indexOf('prerender') !== -1;

        if (!isPrerender) {
            // We never resolve the localstorage or browser language for crawlers, because that might mess up canonical urls

            if (!language || !country) {
                const storage = await I18nController.getLocaleFromStorage();

                if (!language && storage.language) {
                    console.info('Using stored language', storage.language);
                    language = storage.language;
                }

                if (!country && storage.country) {
                    console.info('Using stored country', storage.country);
                    country = storage.country;
                }
            }
        }

        // 2: check the URL. Does it start with a locale or not?
        const parts = UrlHelper.initial.getParts({ removeLocale: false });
        if (parts.length >= 1 && this.isValidLocale(parts[0])) {
            const l = parts[0].substr(0, 2).toLowerCase();
            const c = parts[0].substr(3, 2).toUpperCase();

            if (!language && this.isValidLanguage(l)) {
                console.info('[I18n] Using language from url', l);
                language = l;
                needsSave = true;
            }
            else {
                if (language !== l) {
                    console.warn('[I18n] Ignored language from url', l);
                }
            }

            if (!country && this.isValidCountry(c)) {
                console.info('[I18n] Using country from url', c);
                country = c;
                needsSave = true;
            }
            else {
                if (country as string !== c) {
                    console.warn('[I18n] Ignored country from url', c);
                }
            }
        }
        else if (parts.length >= 1 && (this.fixedCountry || STAMHOOFD.fixedCountry) && parts[0].length === 2) {
            const l = parts[0].substr(0, 2).toLowerCase();

            if (!language && this.isValidLanguage(l)) {
                console.info('[I18n] Using language from url', l);
                language = l;
                needsSave = true;
            }
        }

        // 3. Get country by TLD
        if (!country && !defaultCountry) {
            // try to get country from domain name
            const splitted = window.location.hostname.split('.');
            const tld = splitted[splitted.length - 1].toLowerCase();

            switch (tld) {
                case 'be': {
                    country = Country.Belgium;
                    break;
                }
                case 'nl': {
                    country = Country.Netherlands;
                    break;
                }
                case 'de': {
                    country = Country.Germany;
                    break;
                }
                case 'lu': {
                    country = Country.Luxembourg;
                    break;
                }
                case 'fr': {
                    country = Country.France;
                    break;
                }
                // We used .shop before, but were only active in Belgium
                case 'shop': {
                    country = Country.Belgium;
                    break;
                }
            }

            if (country) {
                console.info('Using country from TLD', '.' + tld, country);
            }
        }

        // 4. Use the browesr language and/or country
        if (!isPrerender) {
            if (!language && navigator.language && navigator.language.length >= 2) {
                const l = navigator.language.substr(0, 2).toLowerCase();
                if (this.isValidLanguage(l)) {
                    language = l;
                    console.info('[I18n] Using browser language', l);
                }
                else {
                    console.warn('[I18n] Browser language ' + language + ' is not supported');
                }
            }

            if (!country && navigator.language && navigator.language.length === 5) {
                const c = navigator.language.substr(3, 2).toUpperCase();
                if (this.isValidCountry(c)) {
                    console.info('[I18n] Using browser country', c);
                    country = c;
                }
                else {
                    console.warn('[I18n] Browser country ' + c + ' is not supported');
                }
            }
        }

        // Default language
        if (!language) {
            if (!defaultLanguage) {
                // try to get country from domain name
                const splitted = window.location.hostname.split('.');
                const tld = splitted[splitted.length - 1].toLowerCase();

                switch (tld) {
                    case 'be': {
                        language = 'nl';
                        break;
                    }
                    case 'nl': {
                        language = 'nl';
                        break;
                    }
                }

                if (language) {
                    console.info('[I18n] Using default language from TLD', '.' + tld, language);
                }
                else {
                    console.info('[I18n] Using fallback language nl');
                    language = 'nl';
                }
            }
            else {
                console.info('[I18n] Using default language', defaultLanguage);
                language = defaultLanguage;
            }
        }

        // Default country
        if (!country) {
            console.log('[I18n] Using default country', defaultCountry ?? Country.Belgium);
            country = defaultCountry ?? Country.Belgium;
        }

        if (I18nController.shared) {
            // Remove listeners
            I18nController.shared.$context?.removeListener(I18nController.shared);
        }

        if (STAMHOOFD.fixedCountry) {
            // Not allowed to change country locale
            country = STAMHOOFD.fixedCountry;
        }

        const def = new I18nController($context, language ?? defaultLanguage ?? Language.Dutch, country, namespace);
        def.defaultCountryCode = defaultCountry ? countryToCode({ country: defaultCountry, defaultCountryCode: def.defaultCountryCode }) : def.defaultCountryCode;
        def.defaultLanguage = defaultLanguage ?? def.defaultLanguage;
        I18nController.shared = def;
        if (import.meta.hot) {
            import.meta.hot.data.shared = def;
        }

        // Automatically set country when the organization is loaded
        $context?.addListener(def, (changed) => {
            if (!$context?.organization) {
                return;
            }
            if (changed == 'organization') {
                def.switchToLocale({ country: $context?.organization.address.country }).catch(console.error);
            }
        });

        // Update already pushed urls
        // this can't work: should remove locale first and then add it
        // for (const state of HistoryManager.states) {
        //    if (state.url) {
        //        state.url = UrlHelper.transformUrlForLocale(state.url, def.language, def.country)
        //    }
        // }

        // If we go back, we might need to update the path of previous urls if the language has changed since then
        // window.addEventListener("popstate", (event) => {
        //     I18nController.shared?.updateUrl()
        // })

        if (needsSave) {
            def.saveLocaleToStorage().catch(console.error);
        }

        // Update meta data
        def.updateMetaData();
        await def.updateUrl();

        await def.loadLocale();
    }

    static getDomain(localizedDomain: LocalizedDomain) {
        const country = I18nController.shared.countryCode;
        return localizedDomain[country] ?? localizedDomain[''];
    }

    // Used to make metaInfo responsive
    currentUrl: UrlHelper = UrlHelper.initial;

    updateMetaData() {
        // Sadly, setting meta tags forces a layout step in the browser
        // This causes dropped frames during animations and makes the app feels unresponsive
        // This is mainly noticeable on older devices
        // this.vueMetaApp?.set(this.metaInfo)
    }

    /**
     * @todo
     * This builds metadata info only for vue-meta, which is no longer maintained
     */
    get metaInfo(): any {
        const listCountries = I18nController.fixedCountry ? [this.countryCode] : countries;
        const url = new UrlHelper();
        const path = url.getPath();
        const hostProtocol = url.getHostWithProtocol();
        const addPrefix = true;

        const links: any['link'] = [];
        const meta: any['meta'] = [];

        // Add og:locale tag
        meta.push({
            hid: 'i18n-og',
            property: 'og:locale',
            // Replace dash with underscore as defined in spec: language_TERRITORY
            content: this.language + '_' + this.countryCode,
        });

        // Alternate locations
        for (const country of listCountries) {
            for (const language of languages) {
                const locale = language + '-' + country;
                links.push({
                    hid: `i18n-alt-${locale}`,
                    rel: 'alternate',
                    href: hostProtocol + this.transformUrlForLocale(path, language, country, addPrefix),
                    hreflang: locale,
                });

                // Add og:locale:alternate
                if (language !== this.language || country != this.countryCode) {
                    // Only list if not the same as current
                    meta.push({
                        hid: `i18n-og-alt-${locale}`,
                        property: 'og:locale:alternate',
                        content: language + '_' + country,
                    });
                }
            }
        }

        // Add default locale
        if (this.defaultCountryCode && this.defaultLanguage) {
            links.push({
                hid: `i18n-alt-default`,
                rel: 'alternate',
                href: hostProtocol + this.transformUrlForLocale(path, this.defaultLanguage, this.defaultCountryCode, addPrefix),
                hreflang: 'x-default',
            });
        }

        // Add canonical url
        // For now, we keep all query parameters
        links.push({
            hid: 'i18n-can',
            rel: 'canonical',
            href: hostProtocol + this.transformUrlForLocale(path, this.language, this.countryCode, addPrefix),
        });

        // If we are in prerender mode, we also want to redirect the crawler if needed
        /*
         <meta name="prerender-status-code" content="302">
         <meta name="prerender-header" content="Location: https://www.google.com">
        */

        const isPrerender = navigator.userAgent.toLowerCase().indexOf('prerender') !== -1;

        if (isPrerender) {
            const currentPath = this.transformUrlForLocale(path, this.language, this.countryCode);

            let redirected = false;
            if (currentPath !== UrlHelper.initial.path) {
                redirected = true;
            }
            meta.push({
                hid: `prerender-status-code`,
                name: 'prerender-status-code',
                content: redirected ? '302' : '200',
            });

            if (redirected) {
            // Don't use canonical host (for now)
                meta.push({
                    hid: `prerender-header`,
                    name: 'prerender-header',
                    content: 'Location: ' + url.getHostWithProtocol() + currentPath,
                });
            }
        }

        return {
            htmlAttrs: {
                lang: this.locale,
            },
            link: links,
            meta,
        };
    }
}
