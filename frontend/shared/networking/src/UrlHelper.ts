import { HistoryManager } from "@simonbackx/vue-app-navigation"
import { I18nController } from "@stamhoofd/frontend-i18n"

export class UrlHelper {

    // Load initial paths
    path: string | null = null
    href: string | null = null
    hash: string | null = null

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
    getPath(options?: { removeLocale?: boolean }) {
        const search = new URL(this.href ?? "/", "https://"+window.location.hostname).search
        return "/"+this.getParts(options).join("/")+search+this.hash
    }

    getParts(options?: { removeLocale?: boolean }) {
        const parts = this.path?.substring(1).split("/") ?? []

        if (parts.length > 0 && (options?.removeLocale === undefined || options?.removeLocale === true) && parts[0].length == 5 && I18nController.isValidLocale(parts[0])) {
            parts.shift()
        }

        console.log("Checking url parts", parts)
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
    static setUrl(url: string) {
        if (I18nController.shared && I18nController.addUrlPrefix && (I18nController.skipUrlPrefixForLocale === undefined || I18nController.skipUrlPrefixForLocale !== I18nController.shared.locale)) {
            HistoryManager.setUrl("/"+I18nController.shared.locale+url)
            console.log("Setting url to", "/"+I18nController.shared.locale+url)
        } else {
            HistoryManager.setUrl(url)
            console.log("Setting url to", url)
        }
    }
}