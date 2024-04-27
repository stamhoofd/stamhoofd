//i18n-setup.js
import { HistoryManager } from "@simonbackx/vue-app-navigation"
import { countries, languages } from "@stamhoofd/locales"
import { Session, SessionManager, Storage, UrlHelper } from '@stamhoofd/networking'
import { Country } from "@stamhoofd/structures"
import Vue from 'vue'
import VueI18n from 'vue-i18n'
import { MetaInfo, VueMetaApp } from "vue-meta"

Vue.use(VueI18n)

export class I18nController {
    static i18n: VueI18n
    static shared: I18nController
    static addUrlPrefix = true
    static skipUrlPrefixForLocale?: string

    /**
     * Whether only one country is enabled for the whole domain
     * -> use for webshops and registration pages
     * -> affects the generated SEO meta tags
     */
    static fixedCountry = false

    namespace = ""
    language = ""
    country = Country.Belgium
    loadedLocale?: string

    // Used for SEO
    defaultCountry = Country.Belgium
    defaultLanguage = "nl"

    // Allows you to set and remove meta data
    vueMetaApp?: VueMetaApp
    
    $context: Session|null|undefined

    get locale() {
        return this.language+"-"+this.country
    }

    constructor($context: Session|undefined|null, language: string, country: Country, namespace: string) {
        this.$context = $context;
        this.namespace = namespace
        this.language = language
        this.country = country
        this.correctLocale()
        Vue.prototype.$country = this.country
    }

    static getI18n(): VueI18n {
        if (this.i18n) {
            return this.i18n
        }
        this.i18n = new VueI18n({
            locale: "en", // set locale
            fallbackLocale: "en",
            messages: {
                // not yet loaded
            }
        })
        return this.i18n
    }

    async switchToLocale(options: {
        language?: string,
        country?: Country
    }) {
        if ((options.country ?? this.country) == this.country && (options.language ?? this.language) == this.language) {
            return
        }
        this.country = options.country ?? this.country
        this.language = options.language ?? this.language
        this.correctLocale()

        // Update url's
        this.updateUrl()

        // Load locale
        await this.loadLocale()

        this.saveLocaleToStorage().catch(console.error)
    }

    updateUrl() {
        // Update url's
        const current = new UrlHelper()
        UrlHelper.setUrl(current.getPath({ removeLocale: true }))
    }

    correctLocale() {
        // Some locales are invalid
        const validLocales = {
            [Country.Belgium]: ["nl", "en"],
            [Country.Netherlands]: ["nl", "en"],
        }

        if (!validLocales[this.country]) {
            // Find first coutnry with same language
            for (const country of countries) {
                if (validLocales[country]?.includes(this.language)) {
                    this.country = country as Country
                    console.info("[I18n] Corrected country to "+country)
                    return
                }
            }

            // Fallback
            this.country = countries[0] as Country
            this.language = validLocales[this.country][0]
            console.info("[I18n] Corrected country to "+this.country + " and language to "+this.language)
            return;
        }

        if (!validLocales[this.country].includes(this.language)) {
            if (validLocales[this.country].includes("en")) {
                this.language = "en"
                console.info("[I18n] Corrected language to en")
                return
            }

            this.language = validLocales[this.country][0]
            console.info("[I18n] Corrected language to "+this.language)
        }
    }

    async loadLocale() {
        Vue.prototype.$country = this.country

        const locale = this.locale
        console.info("[I18n] Loading locale "+locale)
        // If the same language

        if (this.loadedLocale === locale) {
            console.warn("[I18n] Locale already loaded")
            return
        }

        const i18n = I18nController.getI18n()

        // If the language hasn't been loaded yet
        const namespace = this.namespace
        const messages = await import(/* webpackChunkName: "lang-[request]" */ `../../../shared/locales/dist/${namespace}/${locale}.json`)
        i18n.setLocaleMessage(locale, messages.default)
        i18n.locale = locale
        i18n.fallbackLocale = [this.language, "en"]
        this.loadedLocale = locale

        console.log("[I18n] Successfully loaded locale", locale)
    }

    static async getLocaleFromStorage(): Promise<{ language?: string, country?: string }> {
        const country = await Storage.keyValue.getItem("country")
        const language = await Storage.keyValue.getItem("language")

        return {
            country: country && countries.includes(country) ? country : undefined,
            language: language && languages.includes(language) ? language : undefined,
        }
    }

    async saveLocaleToStorage() {
        await Storage.keyValue.setItem("language", this.language)
        await Storage.keyValue.setItem("country", this.country)

        console.info("[I18n] Saved locale to storage", this.locale)
    }

    static isValidLocale(locale: string) {
        if (locale.length == 5 && locale.substr(2, 1) == "-") {
            const l = locale.substr(0, 2).toLowerCase()
            const c = locale.substr(3, 2).toUpperCase()

            return languages.includes(l) && countries.includes(c)
        }
        return false
    }

    static isValidLanguage(language: string) {
        return languages.includes(language)
    }

    static isValidCountry(country: string): country is Country {
        return countries.includes(country)
    }

    static async loadDefault($context: Session|null|undefined, namespace: string, defaultCountry?: Country, defaultLanguage?: string, country?: Country) {
        let language: string | undefined = undefined
        let needsSave = false

        // Check country if passed
        if (country && !this.isValidCountry(country)) {
            console.error("[I18n] Invalid forced country", country)
            country = undefined
        }

        // 1: check the URL. Does it start with a locale or not?
        const parts = UrlHelper.initial.getParts({ removeLocale: false })
        if (parts.length >= 1 && this.isValidLocale(parts[0])) {
            const l = parts[0].substr(0, 2).toLowerCase()
            const c = parts[0].substr(3, 2).toUpperCase()

            if (!language) {
                console.info("[I18n] Using language from url", l)
                language = l
                needsSave = true
            }

            if (!country && this.isValidCountry(c)) {
                console.info("[I18n] Using country from url", c)
                country = c
                needsSave = true
            } else {
                if (country !== c) {
                    console.warn("[I18n] Ignored country from url", c)
                }
            }
        } else if (parts.length >= 1 && this.fixedCountry && parts[0].length == 2) {
            const l = parts[0].substr(0, 2).toLowerCase()

            if (!language && languages.includes(l)) {
                console.info("[I18n] Using language from url", l)
                language = l
                needsSave = true
            }
        }

        // 2. Get by storage
        const isPrerender = navigator.userAgent.toLowerCase().indexOf('prerender') !== -1;

        if (!isPrerender) {
            // We never resolve the localstorage or browser language for crawlers, because that might mess up canonical urls

            if (!language || !country) {
                const storage = await I18nController.getLocaleFromStorage()

                if (!language && storage.language) {
                    console.info("Using stored language", storage.language)
                    language = storage.language
                }

                if (!country && storage.country && this.isValidCountry(storage.country)) {
                    console.info("Using stored country", storage.country)
                    country = storage.country
                }
            }

        }

        // 3. Get country by TLD
        if (!country && !defaultCountry) {
            // try to get country from domain name
            const splitted = window.location.hostname.split(".")
            const tld = splitted[splitted.length - 1].toLowerCase()

            switch (tld) {
                case "be": country = Country.Belgium; break;
                case "nl": country = Country.Netherlands; break;
                case "de": country = Country.Germany; break;
                case "lu": country = Country.Luxembourg; break;
                case "fr": country = Country.France; break;

                // We used .shop before, but were only active in Belgium
                case "shop": country = Country.Belgium; break;
            }

            if (country) {
                console.info("Using country from TLD", "."+tld, country)
            }
        }

        // 4. Use the browesr language and/or country
        if (!isPrerender) {
            if (!language && navigator.language && navigator.language.length >= 2) {
                const l = navigator.language.substr(0, 2).toLowerCase()
                if (languages.includes(l)) {
                    language = l
                    console.info("[I18n] Using browser language", l)
                } else {
                    console.warn("[I18n] Browser language "+language+" is not supported")
                }

            }

            if (!country && navigator.language && navigator.language.length === 5) {
                const c = navigator.language.substr(3, 2).toUpperCase()
                if (this.isValidCountry(c)) {
                    console.info("[I18n] Using browser country", c)
                    country = c
                } else {
                    console.warn("[I18n] Browser country "+c+" is not supported")
                }
            }
        }

        // Default language
        if (!language) {
            if (!defaultLanguage) {
                // try to get country from domain name
                const splitted = window.location.hostname.split(".")
                const tld = splitted[splitted.length - 1].toLowerCase()

                switch (tld) {
                    case "be": language = "nl"; break;
                    case "nl": language = "nl"; break;
                }

                if (language) {
                    console.info("[I18n] Using default language from TLD", "."+tld, language)
                } else {
                    console.info("[I18n] Using fallback language nl")
                    language = "nl"
                }
            } else {
                console.info("[I18n] Using default language", defaultLanguage)
                language = defaultLanguage
            }
        }

        // Default country
        if (!country) {
            console.log("[I18n] Using default country", defaultCountry ?? Country.Belgium)
            country = defaultCountry ?? Country.Belgium
        }

        if (I18nController.shared) {
            // Remove listeners
            I18nController.shared.$context?.removeListener(I18nController.shared)
        }

        const def = new I18nController($context, language, country, namespace)
        def.defaultCountry = defaultCountry ?? def.defaultCountry
        def.defaultLanguage = defaultLanguage ?? def.defaultLanguage
        def.loadedLocale = I18nController.shared?.loadedLocale
        I18nController.shared = def
        def.vueMetaApp = ((window as any).app as any).$meta().addApp('i18n')

        // Automatically set country when the organization is loaded
        $context?.addListener(def, (changed) => {
            if (!$context?.organization) {
                return
            }
            if (changed == "organization") {
                def.switchToLocale({ country: $context?.organization.address.country }).catch(console.error)
            }
        })

        // Update already pushed urls
        for (const state of HistoryManager.states) {
            if (state.url) {
                state.url = UrlHelper.transformUrlForLocale(state.url, def.language, def.country)
            }
        }

        // If we go back, we might need to update the path of previous urls if the language has changed since then
        window.addEventListener("popstate", (event) => {
            I18nController.shared?.updateUrl()
        })

        if (needsSave) {
            def.saveLocaleToStorage().catch(console.error)
        }

        // Update meta data
        def.updateMetaData()
        
        await def.loadLocale()
    }

    // Used to make metaInfo responsive
    currentUrl: UrlHelper = UrlHelper.initial

    updateMetaData() {
        // Sadly, setting meta tags forces a layout step in the browser
        // This causes dropped frames during animations and makes the app feels unresponsive
        // This is mainly noticeable on older devices
        //this.vueMetaApp?.set(this.metaInfo)
    }

    /**
     * Build list for vue-meta with all the available locales
     */
    get metaInfo(): MetaInfo {
        const listCountries = I18nController.fixedCountry ? [this.country] : countries
        const url = new UrlHelper()
        const path = url.getPath()
        const hostProtocol = url.getHostWithProtocol()
        const addPrefix = true

        const links: MetaInfo["link"] = []
        const meta: MetaInfo["meta"] = []

        // Add og:locale tag
        meta.push({
            hid: 'i18n-og',
            property: 'og:locale',
            // Replace dash with underscore as defined in spec: language_TERRITORY
            content: this.language+"_"+this.country
        })

        // Alternate locations
        for (const country of listCountries) {
            for (const language of languages) {
                const locale = language+"-"+country
                links.push({
                    hid: `i18n-alt-${locale}`,
                    rel: "alternate",
                    href: hostProtocol + UrlHelper.transformUrlForLocale(path, language, country, addPrefix),
                    hreflang: locale
                })

                // Add og:locale:alternate
                if (language != this.language || country !=this.country) {
                    // Only list if not the same as current
                    meta.push({
                        hid: `i18n-og-alt-${locale}`,
                        property: 'og:locale:alternate',
                        content: language+"_"+country
                    })
                }
                
            }
        }

        // Add default locale
        if (this.defaultCountry &&  this.defaultLanguage) {
            links.push({
                hid: `i18n-alt-default`,
                rel: "alternate",
                href: hostProtocol + UrlHelper.transformUrlForLocale(path, this.defaultLanguage, this.defaultCountry, addPrefix),
                hreflang: "x-default"
            })
        }

        // Add canonical url
        // For now, we keep all query parameters
        links.push({
            hid: 'i18n-can',
            rel: 'canonical',
            href: hostProtocol+UrlHelper.transformUrlForLocale(path, this.language, this.country, addPrefix)
        })

        // If we are in prerender mode, we also want to redirect the crawler if needed
        /*
         <meta name="prerender-status-code" content="302">
         <meta name="prerender-header" content="Location: https://www.google.com">
        */

        const isPrerender = navigator.userAgent.toLowerCase().indexOf('prerender') !== -1;

        if (isPrerender) {
            const currentPath = UrlHelper.transformUrlForLocale(path, this.language, this.country)

            let redirected = false
            if (currentPath != UrlHelper.initial.path) {
                redirected = true
            }
            meta.push({
                hid: `prerender-status-code`,
                name: 'prerender-status-code',
                content: redirected ? "302" : "200"
            })

            if (redirected) {
            // Don't use canonical host (for now)
                meta.push({
                    hid: `prerender-header`,
                    name: 'prerender-header',
                    content: "Location: "+url.getHostWithProtocol()+currentPath
                })
            }
        }

        return {
            htmlAttrs: {
                lang: this.locale
            },
            link: links,
            meta
        }
    }

}