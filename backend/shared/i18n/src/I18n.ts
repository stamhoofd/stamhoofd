import { DecodedRequest } from '@simonbackx/simple-endpoints';
import { promises as fs } from "fs";
import { countries, languages } from "@stamhoofd/locales"
import { Country } from '@stamhoofd/structures';
import path from "path"

export class I18n {
    static loadedLocales: Map<string, Map<string, string>> = new Map()
    static defaultLanguage = "nl"
    static defaultCountry = Country.Belgium

    static async load() {
        const directory = path.dirname(require.resolve("@stamhoofd/locales"))+"/backend"
        const files = (await fs.readdir(directory, { withFileTypes: true }))
            .filter((dirent) => !dirent.isDirectory())

        for (const file of files ) {
            const locale = file.name.substr(0, file.name.length - 5);
            console.log("loaded locale:" + locale)

            const messages = await import(directory+"/"+file.name)
            this.loadedLocales.set(locale, this.loadRecursive(messages.default))
        }
    }

    static loadRecursive(messages: any, prefix: string | null =  null): Map<string, string> {
        const map = new Map()
        for (const key in messages) {
            const element = messages[key];
            if (typeof (element) != "string") {
                const map2 = this.loadRecursive(element, (prefix ? prefix + "." : "")+key)
                map2.forEach((val, key) => map.set(key, val));
            } else {
                map.set((prefix ? prefix + "." : "")+key, element)
            }
        }
        return map;
    }

    static isValidLocale(locale: string) {
        if (locale.length == 5 && locale.substr(2, 1) == "-") {
            const l = locale.substr(0, 2).toLowerCase()
            const c = locale.substr(3, 2).toUpperCase()

            return languages.includes(l) && countries.includes(c)
        }
        return false
    }
    
    language = ""
    country = ""

    // Reference to messages in loadedLocales
    messages: Map<string, string>

    get locale() {
        return this.language+"-"+this.country
    }

    constructor(language: string, country: string) {
        this.language = language
        this.country = country

        const m = I18n.loadedLocales.get(this.locale)
        if (!m) {
            throw new Error("Locale not loaded when creating I18n for "+language+"-"+country)
        }

        this.messages = m
    }

    switchToLocale(options: {
            language?: string,
            country?: string
    }) {
        this.country = options.country ?? this.country
        this.language = options.language ?? this.language
        
        const m = I18n.loadedLocales.get(this.locale)
        if (!m) {
            throw new Error("Locale not loaded, when switching to locale "+this.language+"-"+this.country)
        }

        this.messages = m
    }

    static fromRequest(request: DecodedRequest<any, any, any>): I18n {
        if ((request as any)._cached_i18n) {
            return (request as any)._cached_i18n
        }

        // Try using custom property
        const localeHeader = request.headers["x-locale"]
        if (localeHeader && typeof localeHeader === "string" && this.isValidLocale(localeHeader)) {
            const l = localeHeader.substr(0, 2).toLowerCase()
            const c = localeHeader.substr(3, 2).toUpperCase()
            
            const i18n = new I18n(l, c);
            (request as any)._cached_i18n = i18n;
            return i18n;
        }

        // Try using accept-language defaults
        const acceptLanguage = request.headers["accept-language"]
        if (acceptLanguage) {
            const splitted = acceptLanguage.split(",");

            // Loop all countries and languages in the header, until we find a valid one
            for (const item of splitted) {
                const trimmed = item.trim();
                const localeSplit = trimmed.split(";");
                const locale = localeSplit[0];

                if (locale.length == 2) {
                    // Language
                    if (languages.includes(locale)) {
                        // Use a default country
                        // Country can get overriden when matching a organization
                        // using .setCountry(country) method
                        const i18n = new I18n(locale, Country.Belgium);
                        (request as any)._cached_i18n = i18n;
                        return i18n
                    }
                } else if (locale.length === 5 && this.isValidLocale(locale)) {
                    const l = locale.substr(0, 2).toLowerCase()
                    const c = locale.substr(3, 2).toUpperCase()

                    // Lang + country
                    const i18n = new I18n(l, c);
                    (request as any)._cached_i18n = i18n;
                    return i18n
                }
                
            }
        }
        const i18n = new I18n(this.defaultLanguage, this.defaultCountry);
        (request as any)._cached_i18n = i18n;
        return i18n;
    }

    t(key: string, replace?: Record<string, string>) {
        return this.$t(key, replace)
    }

    $t(key: string, replace?: Record<string, string>) {
        return this.replace(this.messages.get(key) ?? key, replace)
    }

    escapeRegex(string) {
        return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    }

    replace(text: string, replace?: Record<string, string>) {
        if (!replace) {
            return text
        }
        for (const key in replace) {
            if (replace.hasOwnProperty(key)) {
                const value = replace[key];
                text = text.replace(new RegExp("{"+this.escapeRegex(key)+"}", "g"), value)
            }
        }
        return text
    }
}
