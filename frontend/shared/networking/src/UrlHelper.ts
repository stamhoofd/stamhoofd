import { HistoryManager } from "@simonbackx/vue-app-navigation"
import { I18nController } from "@stamhoofd/frontend-i18n"

export class UrlHelper {
    /** 
     * Use this for the universal fixed prefix
     * 
     * Always remove this prefix when getting an url, and add it when doing setUrl.
     * When you want to host an app in a subdirectory
     * Slashes are added automatically on the sides if needed
    */
    static fixedPrefix: string | null = null

    static shared = new UrlHelper(window.location.href)

    /**
     * The original values when loading the page. Do not modify this one.
     */
    static initial = new UrlHelper(window.location.href)

    url: URL

    localFixedPrefix: string|null

    constructor(url?: string|URL, localFixedPrefix?: string|null) {
        this.url = new URL(url ?? window.location.href)
        this.localFixedPrefix = localFixedPrefix ?? null

        // const state = HistoryManager.states[HistoryManager.states.length-1]
        // if (HistoryManager.active && state && state.url) { 
        //     // Make sure we use the actual state (because location might be slower when the historymanager is still updating the url via async handlers)
        //     this.url.pathname = state.url
        // }
    }

    get path() {
        return this.url.pathname
    }

    get hash() {
        return this.url.hash
    }

    get href() {
        return this.url.href
    }


    get fullPrefix() {
        let prefix = UrlHelper.fixedPrefix ? UrlHelper.fixedPrefix : null
        if (this.localFixedPrefix) {
            if (prefix) {
                prefix += "/" + this.localFixedPrefix
            } else {
                prefix = this.localFixedPrefix
            }
        }
        return prefix
    }

    setPath(path: string) {
        this.url.pathname = path;
    }

    setDomain(domain: string, protocol = 'https') {
        this.url.host = domain;
        this.url.protocol = protocol
    }

    /**
     * Get full path, with the locale removed by default
     * /your-path/test?q=t#hash
     */
    getPath(options?: { removeLocale?: boolean, removePrefix?: boolean, appendPrefix?: string }) {
        const search = new URL(this.href ?? "/", "https://"+window.location.hostname).search
        return "/"+this.getParts(options).join("/")+search+this.hash
    }

    getHostWithProtocol() {
        const url = new URL(this.href ?? "/", "https://"+window.location.hostname)
        return url.protocol+"//"+url.host
    }

    getFullHref(options?: { removeLocale?: boolean, removePrefix?: boolean , host?: string, appendPrefix?: string }) {
        const url = new URL(this.href ?? "/", "https://"+window.location.hostname)
        return url.protocol+"//"+(options?.host ?? url.host)+this.getPath(options)
    }

    getParts(options?: { removeLocale?: boolean, removePrefix?: boolean, appendPrefix?: string }) {
        const parts = this.path?.substring(1).split("/") ?? []

        // Remove empty suffix
        if (parts.length > 0 && parts[parts.length-1] === "") {
            parts.pop()
        }

        if (
            parts.length > 0 
            && (
                options?.removeLocale === undefined || options?.removeLocale === true
            ) 
            && (
                (
                    parts[0].length == 5 && I18nController.isValidLocale(parts[0])
                )
                || (
                    parts[0].length == 2 && I18nController.isValidLanguage(parts[0])
                )
            )
        ) {
            parts.shift()
        }

        if ((options?.removePrefix === undefined || options?.removePrefix === true) && this.fullPrefix) {
            for (const part of this.fullPrefix.split("/") ?? []) {
                if (parts.length > 0 && parts[0] === part) {
                // Remove the prefix
                    parts.shift()
                } else {
                    break
                }
            }
        }

        if (options?.appendPrefix) {
            // TODO: check if locale is okay
            parts.unshift(options.appendPrefix)
        }

        return parts
    }

    getSearchParams() {
        return this.url.searchParams
    }

    getHashParams() {
        return new URLSearchParams(
            this.hash?.substr(1) ?? "" // skip the first char (#)
        );
    }

    clear() {
        this.url = new URL("/", "https://"+window.location.hostname)
    }

    /**
     * setURL, but add locale
     */
    static transformUrlForLocale(url: string, language: string, country: string, addPrefix = true) {
        const prefix = this.fixedPrefix && addPrefix ? "/"+this.fixedPrefix : ""
        const locale = language+"-"+country
        if (I18nController.shared && I18nController.addUrlPrefix && (I18nController.skipUrlPrefixForLocale === undefined || I18nController.skipUrlPrefixForLocale !== locale)) {
            if (I18nController.fixedCountry) {
                return "/"+language+prefix+url
            } else {
                return "/"+language+"-"+country+prefix+url
            }
        } else {
            return prefix+url
        }
    }

    /**
     * override params
     */
    static setSearchParams(params: URLSearchParams) {
        const helper = new UrlHelper()
        const url = new URL(helper.getFullHref())
        url.search = params.toString()
        this.setUrl(url.pathname+url.search+url.hash)
    }

    /**
     * override params
     */
    static addSearchParam(key: string, value: string) {
        const helper = new UrlHelper()
        const url = new URL(helper.getFullHref())
        url.searchParams.set(key, value)
        url.search = url.searchParams.toString()
        this.setUrl(url.pathname+url.search+url.hash)
    }

    /**
     * Return a transformed url (adds locale and fixed prefix to it)
     */
    static transformUrl(url: string, localFixedPrefix?: string) {
        let prefix = this.fixedPrefix ? "/"+this.fixedPrefix : ""
        if (localFixedPrefix) {
            prefix += "/"+localFixedPrefix
        }

        if (I18nController.shared && I18nController.addUrlPrefix && (I18nController.skipUrlPrefixForLocale === undefined || I18nController.skipUrlPrefixForLocale !== I18nController.shared.locale)) {
            if (I18nController.fixedCountry) {
                return "/"+I18nController.shared.language+prefix+url
            } else {
                return "/"+I18nController.shared.locale+prefix+url
            }
        } else {
            return prefix+url
        }
    }

    /**
     * setURL, but add locale
     */
    static setUrl(url: string) {
        console.warn('Used UrlHelper.setUrl', url, 'which should be replaced with this.setUrl()')
        // HistoryManager.setUrl(this.transformUrl(url))
        // I18nController.shared?.updateMetaData()
    }

    match<Keys extends string>(template: string, params: Record<Keys, NumberConstructor | StringConstructor> = {} as Record<Keys, NumberConstructor | StringConstructor>): Record<Keys, number | string> | undefined {
        const parts = this.getParts()
        const templateParts = template.split("/");

        if (parts.length < templateParts.length) {
            // No match
            return;
        }

        const resultParams = {} as any;

        for (let index = 0; index < templateParts.length; index++) {
            const templatePart = templateParts[index];
            const part = parts[index];

            if (templatePart != part) {
                const param = templatePart.substr(1);
                if ((params as any)[param]) {
                    // Found a param
                    resultParams[param] = (params as any)[param](part);

                    if (typeof resultParams[param] === "number") {
                        // Force integers
                        if (!Number.isInteger(resultParams[param])) {
                            return;
                        }
                    }
                    continue;
                }
                // no match
                return;
            }
        }

        return resultParams;
    }
}