import { App } from "vue"

export class I18n {
    loadedLocales: Map<string, Map<string, string>> = new Map()
    loadedNamespaces: Set<string> = new Set()
    locale = "en-US"

    // Reference to messages in loadedLocales
    messages: Map<string, string>

    install(app: App) {
        app.config.globalProperties.$t = this.$t.bind(this)
    }

    loadRecursive(messages: any, prefix: string | null =  null): Map<string, string> {
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

    setLocale(locale: string) {
        this.locale = locale
        const messages = this.loadedLocales.get(locale)
        if (!messages) {
            throw new Error("Locale not loaded when creating I18n for "+locale)
        }
        this.messages = messages
    }

    isLocaleLoaded(namespace: string, locale: string) {
        return this.loadedNamespaces.has(namespace+':'+locale)
    }

    loadLocale(namespace: string, locale: string, messages: any) {
        this.loadedNamespaces.add(namespace + ':' + locale)
        const loaded = this.loadRecursive(messages)
        const existing = this.loadedLocales.get(locale)

        // Merge maps
        if (existing) {
            loaded.forEach((val, key) => existing.set(key, val))
        } else {
            this.loadedLocales.set(locale, loaded)
        }
    }

    t(key: string, replace?: Record<string, string>): string {
        return this.$t(key, replace)
    }

    $t(key: string, replace?: Record<string, string>): string {
        return this.replace(this.messages?.get(key) ?? key, replace)
    }

    escapeRegex(string: string) {
        return string.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    }

    replace(text: string, replace?: Record<string, string>): string {
        if (!replace) {
            return text
        }
        for (const key in replace) {
            const value = replace[key];
            text = text.replace(new RegExp("{"+this.escapeRegex(key)+"}", "g"), value)
        }
        return text
    }
}
