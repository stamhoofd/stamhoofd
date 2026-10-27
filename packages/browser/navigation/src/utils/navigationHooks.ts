import { computed, customRef, getCurrentInstance, inject, isRef, onActivated, onBeforeUnmount, onMounted, onScopeDispose, provide, ref, unref, type Component, type ComponentOptions, type Ref } from 'vue';

import { ComponentWithProperties, HistoryIndex, useCurrentComponent, useParentComponent, type ModalDisplayStyle } from '../ComponentWithProperties.js';
import { HistoryManager, type HistoryUrl } from '../HistoryManager.js';
import NavigationController from '../NavigationController.vue';
import type { PopOptions } from '../PopOptions.js';
import type { PushOptions } from '../PushOptions.js';
import { UrlHelper, mergeSearchParams, templateToUrl, type ParamsFromConstructors, type UrlMatchResult, type UrlParamsConstructors } from './UrlHelper.js';
import { createTrackedSearchParams } from './createTrackedSearchParams.js';

/**
 * reactive_navigation_url
 */
export class ReactiveUrl {
    url: string;
    query: URLSearchParams | null;

    /**
     * The url that actually matched vs the url that will be shown. This is used to support alternative urls
     *
     * E.g.
     * matched:
     * /members/all
     *
     * url:
     * /leden/allemaal
     *
     * When checking further the url, we need to know what we matched earlier
     */
    matched: string;

    constructor({ url, matched, query }: { url: string; matched?: string; query?: URLSearchParams | null }) {
        this.url = url;
        this.matched = matched ?? url;
        this.query = query ?? null;
    }

    extend(url: ReactiveUrl) {
        return new ReactiveUrl({
            url: this.url && this.url !== '/' ? (this.url + '/' + UrlHelper.trim(url.url)) : UrlHelper.trim(url.url),
            matched: this.matched && this.matched !== '/' ? (this.matched + '/' + UrlHelper.trim(url.matched)) : UrlHelper.trim(url.matched),
            query: mergeSearchParams(this.query, url.query),
        });
    }

    toString() {
        return this.transformedHref;
    }

    get transformedHref() {
        return '/' + UrlHelper.trim(UrlHelper.transformUrl(this.url)) + (this.query && this.query.size > 0 ? '?' + this.query.toString() : '');
    }
}

function isPromiseLike<T = unknown>(
    value: unknown,
): value is PromiseLike<T> {
    return (
        value !== null
        && (typeof value === 'object' || typeof value === 'function')
        && typeof (value as any).then === 'function'
    );
}

type DistributiveOmit<T, K extends PropertyKey>
    = T extends unknown ? Omit<T, K> : never;

export function typeRoute<
    const C extends Record<string, StringConstructor | NumberConstructor>,
    Props = unknown,
>(
    route: DistributiveOmit<RouteWithParams<Props, ParamsFromConstructors<C>>, 'params'>
        & { params: C },
): RouteWithParams<Props, ParamsFromConstructors<C>>;

export function typeRoute<Props = unknown>(
    route: RouteWithoutParams<Props>,
): RouteWithoutParams<Props>;

export function typeRoute(route: unknown): unknown {
    return route;
}

/** Registers one route during setup and returns it with parameter inference. Prefer this over heterogeneous defineRoutes arrays. */
export const defineRoute: typeof typeRoute = (route: any) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    defineRoutes([route]);
    return route;
};

type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] };
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
type NotFunction<T> = T extends Function ? never : T;
type RouteLoadComponentResponse = Promise<Component | ComponentWithProperties> | Component | ComponentWithProperties;
type RouteLoadComponent<Props> = (props: Props) => RouteLoadComponentResponse;
type RouteDirectComponent = NotFunction<Component> | 'self';
type RouteComponent<Props>
    = {
        replace?: number;
        force?: boolean;
        present?: ModalDisplayStyle | true;
        show?: true | 'detail' | { getCustomShow: () => (options: PushOptions) => Promise<void> };
        component: RouteDirectComponent | RouteLoadComponent<Props>;
    } | {
        handler: (options: {
            url: ReactiveUrl | string | Ref<ReactiveUrl | string | null> | null;
            adjustHistory: boolean;
            animated: boolean;
            modalDisplayStyle: ModalDisplayStyle | undefined;
            checkRoutes: boolean;
            componentProperties: Props;
        }) => Promise<void>;
    };

export type RouteWithParams<Props, Params> = {
    name?: string;
    url: string;
    ignoreUrls?: string[];

    /**
     * Used for legacy names or migrations when changing urls
     */
    alternativeUrls?: string[];
    params: UrlParamsConstructors<Params>;
    isDefault?: RouteNavigationOptions<Props, Params> & ({ params: Params } | { properties: Props });
    /** Restores component props from URL parameters. May be async; query keys read through the tracked query are retained. */
    paramsToProps: (params: Params, query?: URLSearchParams | null) => Promise<Props> | Props;
    /** Serializes props for programmatic navigation; return query explicitly when it belongs in the URL. */
    propsToParams: (props: Props) => { params: Params; query?: URLSearchParams | null };
} & RouteComponent<Props>;

export type RouteWithoutParams<Props> = {
    name?: string;
    url: string;

    ignoreUrls?: string[];

    /**
     * Used for legacy names or migrations when changing urls
     */
    alternativeUrls?: string[];
    isDefault?: RouteNavigationOptions<Props>;
    /** Supplies props for a route without path parameters, including direct URL entry. May be async. */
    defaultProperties?: (query: URLSearchParams | null) => Promise<Props> | Props;
    propsToParams?: (props: Props) => { params?: undefined; query?: URLSearchParams | null };
} & RouteComponent<Props>;

export type Route<Props = Record<string, unknown>, Params = Record<string, unknown>> = RouteWithParams<Props, Params> | RouteWithoutParams<Props>;
export type RouteNavigationOptions<Props = Record<string, unknown>, Params = Record<string, never>> = {
    /**
     * The url that actually matched, not the url that will be used in the address bar
     *
     * E.g. matched 'members' (alternative url of a route), but will actually show 'leden' (url of the route)
     */
    url?: string;
    params?: Params;
    properties?: Props;
    query?: URLSearchParams;
    animated?: boolean;
    adjustHistory?: boolean;
    checkRoutes?: boolean;
};

export type NavigationOptions<T> = {
    title: string | ((this: T) => string);
    routes?: Route<any>[];
};

/** Setup hook returning the nearest stack's back action. Await it before another transition. */
export function usePop() {
    const rawPop = inject('reactive_navigation_pop', null) as Ref<((options?: PopOptions) => Promise<void>) | undefined> | null;

    return (options?: PopOptions) => {
        const pop = unref(rawPop); // not always reactive
        if (!pop) {
            console.warn('Failed to perform pop');
            return;
        }
        return pop(options);
    };
}

export type ImportRetryMethod = <Args extends unknown[], T>(
    loader: (...args: Args) => Promise<T> | T,
    args: Args,
) => Promise<T> | T;

/**
 * Setup hook returning an awaited route transition. Accepts a route object or a
 * registered name/URL, with either properties or URL params. Unknown names throw.
 * Lazy components and async props require the application's window.PromiseComponent.
 */
export function useNavigate() {
    const instance = getCurrentInstance();
    const present = usePresent();
    const show = useShow();
    const showDetail = useShowDetail();

    const toRoute = async function<Props, Params> (route: Route<Props, Params>, options?: RouteNavigationOptions<Props, Params>) {
        let componentProperties: Props | Promise<Props> | undefined = options?.properties ?? ('defaultProperties' in route && route.defaultProperties ? route.defaultProperties(options?.query ?? null) : null) ?? ({} as Props);
        let params = options?.params ?? {} as Params;
        let query: URLSearchParams | null | Ref<URLSearchParams | null> = options?.query ?? null;

        if (!options?.properties) {
            if ('paramsToProps' in route) {
                // paramsToProps can be a promise, so we need a reactive query
                const reactiveQuery = ref<URLSearchParams | null>(null);
                query = reactiveQuery;
                const trackedQuery = options?.query ? createTrackedSearchParams(options.query) : null;

                function onResolve<T>(r: T) {
                    if (trackedQuery) {
                        // Only store the keys that were actually used
                        const keys = trackedQuery.getReadKeys();
                        if (keys.length) {
                            const query = new URLSearchParams();
                            for (const key of keys) {
                                query.set(key, options!.query!.get(key) ?? '');
                            }
                            reactiveQuery.value = query;
                        } else {
                            reactiveQuery.value = null;
                        }
                    }
                    return r;
                }
                componentProperties = route.paramsToProps(options?.params ?? {} as Params, trackedQuery?.params ?? null);

                if (isPromiseLike(componentProperties)) {
                    componentProperties = componentProperties.then(onResolve);
                } else {
                    onResolve(undefined);
                }
            } else {
                query = null;
                if (options?.params) {
                    console.error('Using route to a route that only has properties, no parameters. Use properties instead of params in navigate() for this route: ' + route.url, route, options);
                }
            }
        }

        if (!options?.params && 'propsToParams' in route && route.propsToParams) {
            // Note that this will never await because componentProperties is already resolved
            const { params: p, query: q } = route.propsToParams(await componentProperties);
            params = p ?? {} as Params;
            query = q ?? null;
        }

        // Build url
        const url = isRef(query)
            ? computed(() => {
                    return new ReactiveUrl({
                        url: templateToUrl(route.url, params ?? {}),
                        matched: options?.url ? templateToUrl(options?.url, params ?? {}) : options?.url,
                        query: unref(query),
                    });
                })
            : new ReactiveUrl({
                    url: templateToUrl(route.url, params ?? {}),
                    matched: options?.url ? templateToUrl(options?.url, params ?? {}) : options?.url,
                    query,
                });

        if ('handler' in route) {
            await route.handler({
                url,
                adjustHistory: options?.adjustHistory ?? true,
                animated: options?.animated ?? true,
                modalDisplayStyle: undefined,
                // modalDisplayStyle: route.present && typeof route.present === 'string' ? route.present : undefined,
                checkRoutes: options?.checkRoutes ?? false,
                componentProperties: await componentProperties,
            });
            return;
        }
        let component: Component;

        // If component is a method, or if componentProperties is a promise, we'll need to wrap it in a loading component
        const isComponentFunction = typeof route.component === 'function' && !(!!route.component.prototype && route.component.prototype.constructor === route.component);
        if (isComponentFunction || (componentProperties as Promise<Record<string, unknown>>).then) {
            const method: (args: Props) => RouteDirectComponent | RouteLoadComponentResponse = isComponentFunction ? (route.component as RouteLoadComponent<Props>) : () => Promise.resolve(route.component as RouteDirectComponent);
            const originalProperties = componentProperties;

            if (!('PromiseComponent' in window)) {
                throw new Error('Required PromiseComponent window variable to make async components work in routes');
            }

            component = window.PromiseComponent as Component;
            const importWithRetry: ImportRetryMethod = '_importWithRetry' in window
                ? (window._importWithRetry as ImportRetryMethod)
                : (a, args) => a(...args);
            componentProperties = {
                promise: async () => {
                    const properties: Props = await originalProperties;
                    const realComponent = await importWithRetry(method, [properties]);
                    if (realComponent instanceof ComponentWithProperties) {
                        return realComponent;
                    }
                    return new ComponentWithProperties(realComponent === 'self' ? (instance?.type as ComponentOptions) : realComponent, properties as Record<string, unknown>);
                },
            } as any; // some magic here
        } else {
            component = route.component === 'self' ? (instance?.type as ComponentOptions) : route.component;
        }

        if (!component) {
            throw new Error('Component not found');
        }

        if (route.present) {
            await present({
                url,
                adjustHistory: options?.adjustHistory ?? true,
                animated: options?.animated ?? true,
                components: [
                    new ComponentWithProperties(NavigationController, {
                        root: new ComponentWithProperties(component, componentProperties as Record<string, unknown>),
                    }),
                ],
                modalDisplayStyle: typeof route.present === 'string' ? route.present : undefined,
                checkRoutes: options?.checkRoutes ?? false,
                replace: route.replace,
                force: route.force,
            });
        } else if (route.show === 'detail') {
            await showDetail({
                url,
                adjustHistory: options?.adjustHistory ?? true,
                animated: options?.animated ?? true,
                components: [
                    new ComponentWithProperties(NavigationController, {
                        root: new ComponentWithProperties(component, componentProperties as Record<string, unknown>),
                    }),
                ],
                checkRoutes: options?.checkRoutes ?? false,
                replace: route.replace,
                force: route.force,
            });
        } else {
            await show({
                url,
                adjustHistory: options?.adjustHistory ?? true,
                animated: options?.animated ?? true,
                components: [
                    new ComponentWithProperties(component, componentProperties as Record<string, unknown>),
                ],
                checkRoutes: options?.checkRoutes ?? false,
                replace: route.replace,
                force: route.force,
            }, typeof route.show === 'object' && route.show !== null && 'getCustomShow' in route.show ? route.show.getCustomShow() : undefined);
        }
    };

    const currentRoutes = getCurrentRoutes();

    const toId = async function<Props, Params>(urlOrName: string, options?: RouteNavigationOptions<Props, Params>) {
        const route = currentRoutes.value.find(r => r.name === urlOrName || r.url === urlOrName);
        if (!route) {
            throw new Error('Route ' + urlOrName + ' not found in ' + instance?.type.name);
            return;
        }

        return await toRoute<Props, Params>(route as Route<Props, Params>, options);
    };

    return async function<Props, Params>(prop1: string | Route<Props, Params>, prop2?: RouteNavigationOptions<Props, Params>) {
        if (typeof prop1 === 'string') {
            return await toId(prop1, prop2);
        }
        await toRoute(prop1, prop2);
    };
}

/**
 * Make sure this component does not have routes on its own but works together with a parent componentWithPeroperties
 */
export function useInheritCheckRoutes() {
    const component = useCurrentComponent();
    const parent = useParentComponent();

    if (component && parent) {
        if (parent.checkRoutes) {
            component.setCheckRoutes();
        }
    }
}

/**
 * Internal helper method, should not get used
 */
function getCurrentRoutes() {
    const component = useCurrentComponent();

    // A not tracked getter is returned
    return customRef(() => {
        return {
            get() {
                // Do not track
                return (component?.navigationRoutes ?? []) as Route[];
            },
            set(newValue: Route[]) {
                if (component) {
                    component.navigationRoutes.splice(0, component.navigationRoutes.length, ...newValue);
                } else {
                    console.error('Missing component when setting routes');
                }
            },
        };
    });
}

export type DefaultRouteHandler = () => Promise<boolean>;

/**
 * Return true when the route has been handled and other route checks should not be executed.
 */
export type OnCheckRoutesHandler = () => Promise<void | boolean> | void | boolean;

export function onCheckRoutes(handler: OnCheckRoutesHandler) {
    const instance = getCurrentInstance() as any;
    instance._navigationCheckRoutesHandlers = [...(instance._navigationCheckRoutesHandlers ?? []), handler];
    addCheckRoutesMountedHandler();
}

export function onNotCheckRoutes(handler: OnCheckRoutesHandler) {
    const instance = getCurrentInstance() as any;
    instance._navigationNotCheckRoutesHandlers = [...(instance._navigationNotCheckRoutesHandlers ?? []), handler];
    addCheckRoutesMountedHandler();
}

function addCheckRoutesMountedHandler() {
    const instance = getCurrentInstance() as any;
    const component = useCurrentComponent();

    if (instance._didAddCheckRoutesMountedHandler) {
        return;
    }

    instance._didAddCheckRoutesMountedHandler = true;

    let doDeactivate = false;

    onBeforeUnmount(() => {
        if (component && doDeactivate) {
            // We only disable checking routes here to allow all child components
            // to execute their route checking methods
            component.checkRoutes = false;
        }
    });

    onMounted(async () => {
        if (component && component.checkRoutes) {
            doDeactivate = true;

            if ('_navigationCheckRoutesHandlers' in instance && Array.isArray(instance._navigationCheckRoutesHandlers)) {
                for (const handler of instance._navigationCheckRoutesHandlers as OnCheckRoutesHandler[]) {
                    if (typeof handler === 'function') {
                        if (await handler() === true) {
                            // Stop if we got a true value
                            return;
                        }
                    } else {
                        console.error('Invalid checkRoutes handler', handler);
                    }
                }
            }
        } else {
            if ('_navigationNotCheckRoutesHandlers' in instance && Array.isArray(instance._navigationNotCheckRoutesHandlers)) {
                for (const handler of instance._navigationNotCheckRoutesHandlers as OnCheckRoutesHandler[]) {
                    if (typeof handler === 'function') {
                        if (await handler() === true) {
                            // Stop if we got a true value
                            return;
                        }
                    } else {
                        console.error('Invalid not checkRoutes handler', handler);
                    }
                }
            }
        }
    });
}

/** Registers routes during setup for direct URL restoration and named navigation. Appends to existing registrations; use defineRoute for stronger per-route inference. */
export function defineRoutes(tmpRoutes: Route<any>[]) {
    const urlhelpers = useUrl();
    const navigate = useNavigate();
    const currentRoutes = getCurrentRoutes();
    const provideDefaultHandler = inject('reactive_provide_default_handler', null) as Ref<((handler: DefaultRouteHandler) => void) | undefined> | null;

    // Store routes somewhere so they can get used
    let hadRoutes = false;
    if (currentRoutes.value.length) {
        hadRoutes = true;
        tmpRoutes = [...currentRoutes.value, ...tmpRoutes];
    }

    currentRoutes.value = tmpRoutes;

    if (hadRoutes || tmpRoutes.length === 0) {
        return;
    }

    async function handleRoutes(routes: Route<any>[]) {
        // Handle automatically
        for (const route of routes) {
            let result: UrlMatchResult<any> | undefined;
            for (const url of [route.url, ...route.alternativeUrls ?? []]) {
                result = urlhelpers.match(url, 'params' in route ? route.params : {}) as UrlMatchResult<any> | undefined;
                if (result) {
                    break;
                }
            }

            if (result) {
                let ignore = false;
                for (const ignoreUrl of route.ignoreUrls ?? []) {
                    const doesMatchIgnore = urlhelpers.match(ignoreUrl, 'params' in route ? route.params : {}) as UrlMatchResult<any> | undefined;
                    if (doesMatchIgnore) {
                        ignore = true;
                        break;
                    }
                }
                if (ignore) {
                    continue;
                }
                try {
                    await navigate(route, {
                        url: result.url,
                        params: 'params' in route ? result.params : undefined,
                        animated: false,
                        adjustHistory: false,
                        query: result.query,
                        checkRoutes: true,
                    });
                    return true; // The route should clear url helpers
                } catch (e) {
                    // Route error:
                    // - continue to next route
                    console.error('Failed to navigate to route', route, e);
                }
            }
        }

        // Check default route
        try {
            if (await defaultHandler({ allowDetail: false })) {
                return true;
            }
        } catch (e) {
            // Route error:
            // - continue to next route
            console.error('Failed to navigate to default (non-detail) route', e);
        }

        return false;
    }

    const getDefaultRoute = ({ allowDetail }: { allowDetail?: boolean } = { allowDetail: true }): WithRequired<Route<Record<string, unknown>, Record<string, unknown>>, 'isDefault'> | null => {
        const routes = currentRoutes.value;
        if (!Array.isArray(routes)) {
            return null;
        }
        return (routes.find(route => route.isDefault && (allowDetail || !('show' in route) || route.show !== 'detail')) as WithRequired<Route<Record<string, unknown>, Record<string, unknown>>, 'isDefault'>) ?? null;
    };

    const defaultHandler = async ({ allowDetail }: { allowDetail?: boolean } = { allowDetail: true }) => {
        const defaultRoute = getDefaultRoute({ allowDetail });
        if (defaultRoute) {
            try {
                await navigate(defaultRoute, {
                    ...defaultRoute.isDefault,
                    adjustHistory: false,
                    checkRoutes: false,
                });
                return true;
            } catch (e) {
                console.error('Failed to navigate to default route', defaultRoute, e);
            }
        }
        return false;
    };

    const setDefaultHandler = () => {
        const dr = getDefaultRoute();
        if (dr) {
            const unreffedProvideDefaultHandler = unref(provideDefaultHandler);
            if (unreffedProvideDefaultHandler) {
                unreffedProvideDefaultHandler(defaultHandler);
            }
        }
    };

    onCheckRoutes(async () => {
        const routes = currentRoutes.value;
        // Check routes
        if (await handleRoutes(routes)) {
            // Handled a route: do not show the default
            setDefaultHandler();
            return;
        }
        setDefaultHandler();
    });

    onNotCheckRoutes(async () => {
        // Always allowed to check default routes (unless detail routes which are handled by the split view controller)
        await defaultHandler({ allowDetail: false });
        setDefaultHandler();
    });
}

export function useCurrentHref() {
    const state = ref(window.location.href);
    const owner = {};

    HistoryManager.addListener(owner, () => {
        state.value = window.location.href;
    });

    onScopeDispose(() => {
        HistoryManager.removeListener(owner);
    });

    return state;
}

/** Setup hook returning a current-URL predicate for registered route names/URLs or route objects. Use in reactive rendering for selection state; unknown names throw. */
export function useCheckRoute() {
    const urlhelpers = useUrl();
    const currentRoutes = getCurrentRoutes();
    const instance = getCurrentInstance();
    const currentPath = useCurrentHref();

    const checkRouteCache: {
        lastUrl: null | string;
        results: Map<string, { result: UrlMatchResult<any> | null | undefined; route: Route<any> }>;
    } = {
        lastUrl: null,
        results: new Map(),
    };

    const checkMatchResult = function<Params extends Record<string, unknown>> (route: Route<Params>, result: UrlMatchResult<Params> | undefined | null, options?: RouteNavigationOptions<Params>) {
        if (!result) {
            return false;
        }

        if (options) {
            for (const key in options.params) {
                if (result.params[key] !== options.params[key]) {
                    return false;
                }
            }

            for (const key in options.query) {
                if (result.query.get(key) !== options.query.get(key)) {
                    return false;
                }
            }

            if (!options?.params && 'propsToParams' in route && options.properties && route.propsToParams) {
                const { params, query } = route.propsToParams(options.properties);

                for (const key in params) {
                    if (result.params[key] !== params[key]) {
                        return false;
                    }
                }

                if (query) {
                    for (const key in query) {
                        if (result.query.get(key) !== query.get(key)) {
                            return false;
                        }
                    }
                }
            }
        }

        return true;
    };

    const quickCheckCache = function<Params extends Record<string, unknown>> (id: string, options?: RouteNavigationOptions<Params>) {
        if (checkRouteCache.lastUrl !== currentPath.value) {
            // Clear cache
            checkRouteCache.results.clear();
            checkRouteCache.lastUrl = currentPath.value;
        } else {
            const result = checkRouteCache.results.get(id);
            if (result) {
                return checkMatchResult(result.route, result.result, options);
            }
        }
    };

    const checkRoute = function<Params extends Record<string, unknown>> (route: Route<Params>, options?: RouteNavigationOptions<Params>) {
        const result = urlhelpers.matchCurrent(route.url, 'params' in route ? route.params : {}) as UrlMatchResult<Params> | undefined;
        checkRouteCache.results.set(route.url, { result, route });
        if (route.name) {
            checkRouteCache.results.set(route.name, { result, route });
        }

        return checkMatchResult(route, result, options);
    };

    const checkId = function<Params extends Record<string, unknown>>(urlOrName: string, options?: RouteNavigationOptions<Params>) {
        const result = quickCheckCache(urlOrName, options);
        if (result !== undefined) {
            return result;
        }
        const route = currentRoutes.value.find(r => r.name === urlOrName || r.url === urlOrName);
        if (!route) {
            throw new Error('Route ' + urlOrName + ' not found in ' + instance?.type.name);
        }

        return checkRoute(route, options);
    };

    return function<Params extends Record<string, unknown>> (prop1: string | Route<Params>, prop2?: RouteNavigationOptions<Params>) {
        if (typeof prop1 === 'string') {
            return checkId(prop1, prop2);
        }
        const result = quickCheckCache(prop1.name || prop1.url, prop2);
        if (result !== undefined) {
            return result;
        }
        return checkRoute(prop1, prop2);
    };
}

export function normalizePushOptions(o: PushOptions | ComponentWithProperties, currentComponent: ComponentWithProperties | null, urlHelpers: ReturnType<typeof useUrl>): PushOptions {
    let options: PushOptions;
    if (!(o as any).components) {
        options = ({ components: [o as ComponentWithProperties] });
    } else {
        options = o as PushOptions;
    }

    if (options.checkRoutes) {
        // If we show a navigation controller, we should also set checkRoutes on the roots
        options.components[options.components.length - 1].setCheckRoutes();
    }

    if (currentComponent) {
        for (const component of options.components) {
            component.inheritFromDisplayer(currentComponent);
        }
    } else {
        console.warn('Using show or present outside of a component: Inherited properties will not be set.');
    }

    if (options.url !== undefined) {
        const url = options.url;

        for (const component of options.components) {
            component.provide.reactive_navigation_url = computed(() => {
                const u = unref(url);

                return u === null
                    ? null
                    : urlHelpers.extendUrl(typeof u === 'string' ? new ReactiveUrl({ url: u }) : u, { returnHistory: options.replace ?? 0 });
            });
        }
    }

    return options as PushOptions;
}

export function useManualPresent() {
    const currentComponent = useCurrentComponent();
    const urlHelpers = useUrl();

    return (present: (options: PushOptions) => Promise<void> | void, options: PushOptions | ComponentWithProperties) => {
        return present(normalizePushOptions(options, currentComponent, urlHelpers));
    };
}

/** Setup hook returning a push action on the nearest stack. Plain pushes preserve covered views; replacement checks their leave guards. */
export function useShow() {
    const currentComponent = useCurrentComponent();
    const rawShow = inject('reactive_navigation_show', null) as Ref<(options: PushOptions) => Promise<void>> | null;
    const urlHelpers = useUrl();

    return (options: PushOptions | ComponentWithProperties, customShow?: (options: PushOptions) => Promise<void>) => {
        const show = customShow ?? unref(rawShow); // not always reactive

        if (!show) {
            console.warn('Failed to perform show');
            return Promise.resolve();
        }

        return show(normalizePushOptions(options, currentComponent, urlHelpers));
    };
}

export function useShowDetail() {
    const currentComponent = useCurrentComponent();
    const rawShowDetail = inject('reactive_navigation_show_detail', null) as Ref<(options: PushOptions | ComponentWithProperties) => Promise<void>> | null;
    const urlHelpers = useUrl();

    return (options: PushOptions | ComponentWithProperties) => {
        const showDetail = unref(rawShowDetail); // not always reactive

        if (!showDetail) {
            console.warn('Failed to perform showDetail');
            return Promise.resolve();
        }

        return showDetail(normalizePushOptions(options, currentComponent, urlHelpers));
    };
}

/** Setup hook starting a modal flow above the current view. Does not remove the covered view or invoke its leave guard. */
export function usePresent() {
    const currentComponent = useCurrentComponent();
    const rawPresent = inject('reactive_navigation_present', null) as Ref<((options: PushOptions | ComponentWithProperties) => Promise<void>) | undefined> | null;
    const urlHelpers = useUrl();

    return async (options: PushOptions | ComponentWithProperties) => {
        const present = unref(rawPresent); // not always reactive

        if (!present) {
            console.warn('Failed to perform present');
            return Promise.resolve();
        }

        return present(normalizePushOptions(options, currentComponent, urlHelpers));
    };
}

/** Setup hook closing the enclosing presented flow, including its child stack. Await before starting another transition. */
export function useDismiss() {
    const rawDismiss = inject('reactive_navigation_dismiss', null) as Ref<(options?: PopOptions) => Promise<void>> | null;

    return (options?: PopOptions) => {
        const dismiss = unref(rawDismiss); // not always reactive

        if (!dismiss) {
            console.warn('Failed to perform dismiss');
            return Promise.resolve();
        }

        return dismiss(options);
    };
}

/** Reactive back-button availability, including an inherited parent stack. This does not evaluate leave guards. */
export function useCanPop(): Ref<boolean> {
    const rawPop = inject('reactive_navigation_can_pop', false) as Ref<boolean | undefined> | false;
    return computed(() => {
        return !!unref(rawPop);
    });
}

/** Reactive availability of a modal close action; this does not evaluate leave guards. */
export function useCanDismiss(): Ref<boolean> {
    const rawDismiss = inject('reactive_navigation_can_dismiss', false) as Ref<boolean | undefined> | false;
    return computed(() => !!unref(rawDismiss));
}

export function useFocused() {
    const rawFocused = inject('reactive_navigation_focused', true) as Ref<boolean> | boolean;
    return computed(() => !!unref(rawFocused));
}

/**
 * Returns a setter that lets the current component signal to its nearest navigation controller
 * whether it currently renders content. This uses an opt-out model: components are assumed to
 * have content unless they call the setter with `false`.
 *
 * This is useful for placeholder/loading components (e.g. an async component that is still
 * loading): while they have no content, the navigation controller keeps its frozen height during
 * navigation animations instead of collapsing to the height of the empty placeholder. Once the
 * real content arrives, calling the setter with `true` animates the controller to the real height.
 */
export function useContentState() {
    const component = useCurrentComponent();
    const controller = inject('reactive_navigationController', null) as Ref<{ setContentState?: (component: ComponentWithProperties, hasContent: boolean) => void } | null> | { setContentState?: (component: ComponentWithProperties, hasContent: boolean) => void } | null;

    return (hasContent: boolean) => {
        const c = unref(controller);
        if (c && component && typeof c.setContentState === 'function') {
            c.setContentState(component, hasContent);
        }
    };
}

/**
 * Returns a function that animates the nearest navigation controller around an in-place content
 * change. Outside a navigation controller, the change is still applied without animation.
 */
export function useAnimateHeightChange() {
    const controller = inject('reactive_navigationController', null) as Ref<{ animateHeightChange?: (applyChange: () => void | Promise<void>) => Promise<void> } | null> | { animateHeightChange?: (applyChange: () => void | Promise<void>) => Promise<void> } | null;

    return async (applyChange: () => void | Promise<void>) => {
        const c = unref(controller);
        if (c && typeof c.animateHeightChange === 'function') {
            await c.animateHeightChange(applyChange);
            return;
        }
        await applyChange();
    };
}

/**
 * Add a url 'prefix' to the current url and all its children
 */
export function extendUrl(url: ReactiveUrl | string | Ref<ReactiveUrl | string>) {
    const urlHelpers = useUrl();
    provide('reactive_navigation_url', computed(() => {
        const u = unref(url);
        return urlHelpers.extendUrl(typeof u === 'string' ? new ReactiveUrl({ url: u }) : u);
    }));
}

export function setTitleSuffix(title: string) {
    HistoryManager.titleSuffix = title;
}

export function setTitle(title: string) {
    if (!title) {
        return;
    }
    const urlHelpers = useUrl();
    onActivated(() => {
        urlHelpers.setTitle(title);
    });
}

export function setUrl(url: HistoryUrl, title?: string) {
    const urlHelpers = useUrl();

    onMounted(() => {
        urlHelpers.overrideUrl(url, title);
    });
}

export function useUrl() {
    const currentComponent = useCurrentComponent();
    const navigationUrl = inject('reactive_navigation_url', null) as Ref<ReactiveUrl | undefined> | null;
    const navigationQuery = inject('reactive_navigation_query', null) as Ref<URLSearchParams | undefined> | null;
    const disableUrl = inject('reactive_navigation_disable_url', null) as Ref<boolean | undefined> | null;
    const historyIndex = inject('navigation_historyIndex', null) as Ref<HistoryIndex | undefined> | null;

    return {
        getUrl() {
            return unref(navigationUrl) ?? null;
        },

        getQuery() {
            return unref(navigationQuery) ?? null;
        },

        /**
         * Ideally call this after you've processed all the .match() calls (and awaited async stuff)
         */
        setTitle(title: string) {
            if (!currentComponent) {
                console.error('No current component while setting title', title);
                return;
            }
            if (unref(disableUrl)) {
                return;
            }

            if (title) {
                currentComponent.setTitle(title);
            }
        },

        extendUrl(url: ReactiveUrl, options: { returnHistory?: number } = {}): ReactiveUrl {
            let prefix = this.getUrl();
            if (options.returnHistory) {
                const index = unref(historyIndex);
                if (index !== null && index !== undefined) {
                    prefix = HistoryManager.getStateUrl(index.index - options.returnHistory);
                } else {
                    console.error('Failed to get history index');
                }
            }

            if (prefix) {
                return prefix.extend(url);
            }
            return url;
        },

        match<Params>(template: string, params?: UrlParamsConstructors<Params>): UrlMatchResult<Params> | undefined {
            const shared = UrlHelper.shared;
            const helper = new UrlHelper(shared.url, this.getUrl()?.matched);
            return helper.match(template, params);
        },

        matchCurrent<Params>(template: string, params?: UrlParamsConstructors<Params>): UrlMatchResult<Params> | undefined {
            const helper = new UrlHelper(undefined, this.getUrl()?.url);
            return helper.match(template, params);
        },

        overrideUrl(url: HistoryUrl, title?: string) {
            if (!currentComponent) {
                console.error('No current component while setting title', title);
                return;
            }
            if (unref(disableUrl)) {
                return;
            }
            currentComponent?.overrideUrl(url, title);
        },
    };
}
