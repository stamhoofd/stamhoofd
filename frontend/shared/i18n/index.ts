//i18n-setup.js
import { countries, languages } from "@stamhoofd/locales"
import { SessionManager, UrlHelper } from '@stamhoofd/networking'
import Vue from 'vue'
import VueI18n from 'vue-i18n'

Vue.use(VueI18n)

export class I18nController {
    namespace = ""
    language = ""
    country = ""
    
    static i18n: VueI18n

    static shared: I18nController

    loadedLocale?: string

    get locale() {
        return this.language+"-"+this.country
    }

    constructor(language: string, country: string, namespace: string) {
        this.namespace = namespace
        this.language = language
        this.country = country
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
            country?: string
    }) {
        if ((options.country ?? this.country) == this.country && (options.language ?? this.language) == this.language) {
            return
        }
        this.country = options.country ?? this.country
        this.language = options.language ?? this.language

        // Update url's
        this.updateUrl()

        // Load locale
        await this.loadLocale()
    }

    updateUrl() {
         // Update url's
        const current = new UrlHelper()
        UrlHelper.setUrl(current.getPath({ removeLocale: true }))
    }

    async loadLocale() {
        const locale = this.locale
        console.info("Loading locale "+locale)
        // If the same language

        if (this.loadedLocale === locale) {
            console.warn("Locale already loaded")
            return
        }

        const i18n = I18nController.getI18n()

        // If the language hasn't been loaded yet
        const messages = await import(/* webpackChunkName: "lang-[request]" */ `@stamhoofd/locales/dist/${this.namespace}/${locale}.json`)
        i18n.setLocaleMessage(locale, messages.default)
        i18n.locale = locale
        i18n.fallbackLocale = [this.language, "en"]
        this.loadedLocale = locale

        console.log("Successfully loaded locale", locale)
    }

    static isValidLocale(locale: string) {
        if (locale.length == 5 && locale.substr(2, 1) == "-") {
            const l = locale.substr(0, 2).toLowerCase()
            const c = locale.substr(3, 2).toUpperCase()

            return languages.includes(l) && countries.includes(c)
        }
        return false
    }

    static async loadDefault(namespace: string, country?: string) {
        let language: string | undefined = undefined

        // Check country if passed
        if (country && !countries.includes(country)) {
            console.error("Invalid default country", country)
            country = undefined
        }

        // 1: check the URL. Does it start with a locale or not?
        const parts = UrlHelper.initial.getParts({ removeLocale: false })
        if (parts.length >= 1 && this.isValidLocale(parts[0])) {
            const l = parts[0].substr(0, 2).toLowerCase()
            const c = parts[0].substr(3, 2).toUpperCase()

            if (!language) {
                console.info("Using language from url", l)
                language = l
            }

            if (!country) {
                country = c
                console.info("Using country from url", country)
            } else {
                if (country !== c) {
                    console.warn("Ignored country from url", c)
                }
            }
        }

        // 2. If it doesn't start with a locale: use the brower language and/or country by default
        if (!language && navigator.language && navigator.language.length >= 2) {
            const l = navigator.language.substr(0, 2).toLowerCase()
            if (languages.includes(l)) {
                language = l
                console.info("Using browser language", l)
            } else {
                console.warn("Browser language "+language+" is not supported")
            }

        }

        if (!country && navigator.language && navigator.language.length === 5) {
            const c = navigator.language.substr(3, 2).toUpperCase()
            if (countries.includes(c)) {
                console.info("Using browser country", c)
                country = c
            } else {
                console.warn("Browser country "+c+" is not supported")
            }
        }

        // Default language
        if (!language) {
            console.log("Using default language")
            language = "nl"
        }

        // Default country
        if (!country) {
            console.log("Using default country")
            country = "BE"
        }

        const def = new I18nController(language, country, namespace)
        I18nController.shared = def

        // Automatically set country when the organization is loaded
        SessionManager.addListener(def, (changed) => {
            if (!SessionManager.currentSession?.organization) {
                return
            }
            if (changed == "session" || changed == "organization") {
                def.switchToLocale({ country: SessionManager.currentSession.organization.address.country }).catch(console.error)
            }
        })

        // If we go back, we might need to update the path of previous urls if the language has changed since then
        window.addEventListener("popstate", (event) => {
            I18nController.shared?.updateUrl()
        })
        
        await def.loadLocale()
    }

    createFromLocalStorage(): I18nController {
        // todo
        return new I18nController("", "", "")
    }

    createFromLocale(namespace: string): I18nController {
        // todo
        return new I18nController("nl", "BE", namespace)
    }

}