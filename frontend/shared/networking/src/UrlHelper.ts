import { HistoryManager } from "@simonbackx/vue-app-navigation"
import { I18nController } from "@stamhoofd/frontend-i18n"

export class UrlHelper {
    /** 
     * Always remove this prefix when getting an url, and add it when doing setUrl.
     * When you want to host an app in a subdirectory
     * Slashes are added automatically on the sides if needed
    */
    static fixedPrefix: string | null = null

    static shared = new UrlHelper()

    /**
     * The original values when loading the page. Do not modify this one.
     */
    static initial = new UrlHelper()

    url: URL

    constructor() {
        this.url = new URL(window.location.href)
        const state = HistoryManager.states[HistoryManager.states.length-1]
        if (HistoryManager.active && state && state.url) { 
            // Make sure we use the actual state (because location might be slower when the historymanager is still updating the url via async handlers)
            this.url.pathname = state.url
        }
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

        if ((options?.removePrefix === undefined || options?.removePrefix === true) && UrlHelper.fixedPrefix) {
            for (const part of UrlHelper.fixedPrefix.split("/") ?? []) {
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
    static transformUrl(url: string) {
        const prefix = this.fixedPrefix ? "/"+this.fixedPrefix : ""
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
        HistoryManager.setUrl(this.transformUrl(url))
        I18nController.shared?.updateMetaData()
    }
}