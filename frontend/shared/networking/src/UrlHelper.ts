import { HistoryManager } from "@simonbackx/vue-app-navigation"
import { I18nController } from "@stamhoofd/frontend-i18n"

export class UrlHelper {

    // Load initial paths
    path: string | null = null
    href: string | null = null
    hash: string | null = null

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

    constructor() {
        this.path = window.location.pathname
        this.href = window.location.href
        this.hash = window.location.hash
    }

    /**
     * Get full path, with the locale removed by default
     * /your-path/test?q=t#hash
     */
    getPath(options?: { removeLocale?: boolean, removePrefix?: boolean  }) {
        const search = new URL(this.href ?? "/", "https://"+window.location.hostname).search
        return "/"+this.getParts(options).join("/")+search+this.hash
    }

    getHostWithProtocol() {
        const url = new URL(this.href ?? "/", "https://"+window.location.hostname)
        return url.protocol+"//"+url.host
    }

    getFullHref(options?: { removeLocale?: boolean, removePrefix?: boolean , host?: string }) {
        const url = new URL(this.href ?? "/", "https://"+window.location.hostname)
        return url.protocol+"//"+(options?.host ?? url.host)+this.getPath(options)
    }

    getParts(options?: { removeLocale?: boolean, removePrefix?: boolean }) {
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

        return parts
    }

    getSearchParams() {
        return new URL(this.href ?? "/", "https://"+window.location.hostname).searchParams
    }

    getHashParams() {
        return new URLSearchParams(
            this.hash?.substr(1) ?? "" // skip the first char (#)
        );
    }

    clear() {
        this.path = null
        this.href = null
        this.hash = null
    }

    /**
     * setURL, but add locale
     */
    static transformUrlForLocale(url: string, language: string, country: string) {
        const prefix = this.fixedPrefix ? "/"+this.fixedPrefix : ""
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
     * setURL, but add locale
     */
    static setUrl(url: string) {
        const prefix = this.fixedPrefix ? "/"+this.fixedPrefix : ""
        if (I18nController.shared && I18nController.addUrlPrefix && (I18nController.skipUrlPrefixForLocale === undefined || I18nController.skipUrlPrefixForLocale !== I18nController.shared.locale)) {
            if (I18nController.fixedCountry) {
                HistoryManager.setUrl("/"+I18nController.shared.language+prefix+url)
                console.log("Setting url to", "/"+I18nController.shared.language+prefix+url)
            } else {
                HistoryManager.setUrl("/"+I18nController.shared.locale+prefix+url)
                console.log("Setting url to", "/"+I18nController.shared.locale+prefix+url)
            }
        } else {
            HistoryManager.setUrl(prefix+url)
            console.log("Setting url to", prefix+url)
        }
    }
}