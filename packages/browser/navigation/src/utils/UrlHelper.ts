export class UrlHelper {
    /**
     * Use this for the universal fixed prefix
     *
     * Always remove this prefix when getting an url, and add it when doing setUrl.
     * When you want to host an app in a subdirectory
     * Slashes are added automatically on the sides if needed
    */
    static fixedPrefix: string | null = null;
    static localePrefix: string | null = null;

    static shared = new UrlHelper(window.location.href);

    /**
     * The original values when loading the page. Do not modify this one.
     */
    static initial = new UrlHelper(window.location.href);

    url: URL;

    localFixedPrefix: string | null;

    constructor(url?: string | URL, localFixedPrefix?: string | null) {
        this.url = new URL(url ?? window.location.href);
        this.localFixedPrefix = localFixedPrefix ?? null;

        // const state = HistoryManager.states[HistoryManager.states.length-1]
        // if (HistoryManager.active && state && state.url) {
        //     // Make sure we use the actual state (because location might be slower when the historymanager is still updating the url via async handlers)
        //     this.url.pathname = state.url
        // }
    }

    get path() {
        return this.url.pathname;
    }

    get hash() {
        return this.url.hash;
    }

    get href() {
        return this.url.href;
    }

    get fullPrefix() {
        let prefix = UrlHelper.fixedPrefix ? UrlHelper.trim(UrlHelper.fixedPrefix) : null;
        if (this.localFixedPrefix) {
            if (prefix) {
                prefix += '/' + UrlHelper.trim(this.localFixedPrefix);
            }
            else {
                prefix = UrlHelper.trim(this.localFixedPrefix);
            }
        }
        return prefix;
    }

    setPath(path: string) {
        this.url.pathname = path;
    }

    setDomain(domain: string, protocol = 'https') {
        this.url.host = domain;
        this.url.protocol = protocol;
    }

    /**
     * Get full path, with the locale removed by default
     * /your-path/test?q=t#hash
     */
    getPath(options?: { removeLocale?: boolean; removePrefix?: boolean; appendPrefix?: string }) {
        const search = new URL(this.href ?? '/', 'https://' + window.location.hostname).search;
        return '/' + this.getParts(options).join('/') + search + this.hash;
    }

    getHostWithProtocol() {
        const url = new URL(this.href ?? '/', 'https://' + window.location.hostname);
        return url.protocol + '//' + url.host;
    }

    getFullHref(options?: { removeLocale?: boolean; removePrefix?: boolean; host?: string; appendPrefix?: string }) {
        const url = new URL(this.href ?? '/', 'https://' + window.location.hostname);
        return url.protocol + '//' + (options?.host ?? url.host) + this.getPath(options);
    }

    getParts(options?: { removeLocale?: boolean; removePrefix?: boolean; appendPrefix?: string }) {
        const parts = this.path?.substring(1).split('/') ?? [];

        // Remove empty suffix
        if (parts.length > 0 && parts[parts.length - 1] === '') {
            parts.pop();
        }

        if (
            parts.length > 0
            && (
                options?.removeLocale === undefined || options?.removeLocale === true
            )
            && (
                (
                    parts[0].length == 5 && parts[0].substring(2, 3) === '-' // && I18nController.isValidLocale(parts[0])
                )
                || (
                    parts[0].length == 2// && I18nController.isValidLanguage(parts[0])
                )
            )
        ) {
            parts.shift();
        }

        if ((options?.removePrefix === undefined || options?.removePrefix === true) && this.fullPrefix) {
            for (const part of this.fullPrefix.split('/') ?? []) {
                if (parts.length > 0 && parts[0] === part) {
                // Remove the prefix
                    parts.shift();
                }
                else {
                    break;
                }
            }
        }

        if (options?.appendPrefix) {
            // TODO: check if locale is okay
            parts.unshift(options.appendPrefix);
        }

        return parts;
    }

    getSearchParams() {
        return this.url.searchParams;
    }

    getHashParams() {
        return new URLSearchParams(
            this.hash?.substr(1) ?? '', // skip the first char (#)
        );
    }

    clear() {
        this.url = new URL('/', 'https://' + window.location.hostname);
    }

    /**
     * override params
     */
    static setSearchParams(params: URLSearchParams) {
        const helper = new UrlHelper();
        const url = new URL(helper.getFullHref());
        url.search = params.toString();
        this.setUrl(url.pathname + url.search + url.hash);
    }

    /**
     * override params
     */
    static addSearchParam(key: string, value: string) {
        const helper = new UrlHelper();
        const url = new URL(helper.getFullHref());
        url.searchParams.set(key, value);
        url.search = url.searchParams.toString();
        this.setUrl(url.pathname + url.search + url.hash);
    }

    /**
     * Return a transformed url (adds locale and fixed prefix to it)
     */
    static transformUrl(url: string, localFixedPrefix?: string) {
        let prefix = this.fixedPrefix ? ('/' + UrlHelper.trim(this.fixedPrefix)) : '';
        if (localFixedPrefix) {
            prefix += '/' + UrlHelper.trim(localFixedPrefix);
        }

        if (this.localePrefix) {
            return '/' + UrlHelper.trim(this.localePrefix) + prefix + '/' + UrlHelper.trim(url);
        }

        return prefix + '/' + UrlHelper.trim(url);
    }

    /**
     * @deprecated
     * setURL, but add locale
     */
    static setUrl(url: string) {
        console.warn('Used UrlHelper.setUrl', url, 'which should be replaced with this.setUrl()');
    }

    static trim(url: string): string {
        return url.replace(/^\/+/, '').replace(/\/+$/, '');
    }

    match<Params>(template: string, params?: UrlParamsConstructors<Params>): UrlMatchResult<Params> | undefined {
        return matchPath(this.getParts(), this.getSearchParams(), template, params);
    }
}

type ConstructorToType<C> =
    C extends NumberConstructor ? number :
        C extends StringConstructor ? string :
            C extends BooleanConstructor ? boolean :
                never;

// Inverse of UrlParamsConstructors
export type ParamsFromConstructors<C> = {
    [K in keyof C]: ConstructorToType<C[K]>;
};

export type UrlParamsConstructors<Params> = {
    [Key in keyof Params]: Params[Key] extends number ? NumberConstructor : StringConstructor
};
export type UrlQueryConstructors<Query> = {
    [Key in keyof Query]: Query[Key] extends number ? NumberConstructor : StringConstructor
};
export type UrlMatchResult<Params> = { params: Params; url: string; query: URLSearchParams };

export function mergeSearchParams(
    a: URLSearchParams | null,
    b: URLSearchParams | null,
): URLSearchParams | null {
    if (a === null && b === null) {
        return null;
    }
    if (a === null) {
        return new URLSearchParams(b!);
    }
    if (b === null) {
        return new URLSearchParams(a!);
    }

    const merged = new URLSearchParams(a);

    for (const [key, value] of b.entries()) {
        merged.append(key, value);
    }

    return merged;
}

export function matchPath<Params>(path: string | string[], query: URLSearchParams, template: string, params?: UrlParamsConstructors<Params>): UrlMatchResult<Params> | undefined {
    if (template === '') {
        return {
            params: {} as any,
            url: '',
            query,
        };
    }

    const parts = Array.isArray(path) ? path : UrlHelper.trim(path).split('/');
    const templateParts = UrlHelper.trim(template).split('/');

    if (parts.length < templateParts.length) {
        // No match
        return;
    }

    const resultParams = {} as any;

    for (let index = 0; index < templateParts.length; index++) {
        const templatePart = templateParts[index];
        const part = parts[index];

        if (templatePart !== part) {
            if (templatePart[0] === '@') {
                const param = templatePart.substr(1);

                if ((params as any)[param]) {
                    // Found a param
                    resultParams[param] = (params as any)[param](part);

                    if (typeof resultParams[param] === 'number') {
                        // Force integers
                        if (!Number.isInteger(resultParams[param])) {
                            return;
                        }
                    }
                    continue;
                }
            }
            // no match
            return;
        }
    }

    return {
        params: resultParams,
        url: parts.slice(0, templateParts.length).join('/'),
        query,
    };
}

export function matchQuery() {

}

export function templateToUrl<Params>(template: string, params: Params): string {
    const templateParts = UrlHelper.trim(template).split('/');

    for (let index = 0; index < templateParts.length; index++) {
        const templatePart = templateParts[index];

        if (templatePart[0] === '@') {
            const param = templatePart.substr(1);

            if ((params as any)[param]) {
                // Replace the template part
                templateParts[index] = (params as any)[param].toString();
            }
            else {
                throw new Error('Missing param: ' + param);
            }
        }
    }

    return templateParts.slice(0, templateParts.length).join('/');
}
