export class UrlHelper {

    // Load initial paths
    path: string | null = null
    href: string | null = null
    hash: string | null = null

    static shared = new UrlHelper()

    constructor() {
        this.path = window.location.pathname
        this.href = window.location.href
        this.hash = window.location.hash
    }

    getParts() {
        return this.path?.substring(1).split("/") ?? []
    }

    getSearchParams() {
        return new URL(this.href ?? "/").searchParams
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
}