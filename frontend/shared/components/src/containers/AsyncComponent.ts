import type { ImportRetryMethod } from '@simonbackx/vue-app-navigation';
import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';

import { isModuleImportError } from '#errors/isModuleImportError.ts';
import { AppManager } from '@stamhoofd/networking/AppManager';
import { sleep } from '@stamhoofd/utility';
import { Toast } from '../overlays/Toast';
import ImportErrorView from './ImportErrorView.vue';
import PromiseView from './PromiseView.vue';

/**
 * Maximum number of attempts (initial try + retries) before giving up on loading a module.
 */
const MAX_IMPORT_ATTEMPTS = 5;

function getImportUrl(loader: () => any): URL | null {
    const str = loader.toString();
    const match = str.match(/\bimport\(\s*["']([^"']+)["']\s*\)/);
    if (!match) {
        console.info('Could not detect import url for ', loader);
        // Unexpected build output (couldn't find the URL): fall back to a plain retry.
        return null;
    }
    const original = match[1];

    try {
        const url = new URL(original, import.meta.url);
        return url;
    } catch (e) {
        // Invalid url
        return null;
    }
}

/**
 * Re-import a module while bypassing the browser's module cache.
 *
 * When a dynamic import() fails, the browser records the module as "errored" in its internal
 * module map (keyed by URL). Re-running the identical import() returns that cached rejection
 * without touching the network again — so a plain retry can never recover, even after the
 * connection is restored. Appending a unique query string changes the module specifier and
 * forces a fresh fetch.
 *
 * This is a bit hacky,
 * but we'll only retry this once to catch most temporary network issues
 * if that still fails we'll reload the page - that fixes the issue with
 * loading issues of dependenices of the imported file, which we cannot retry sadly
 *
 * The chunk URL is recovered from the loader's source: a Vite-generated `() => import('...')`
 * keeps the URL as a string literal, even after minification. All Vite chunks are emitted to
 * the same directory, so the (usually relative) URL resolves correctly against this module.
 */
async function reimportWithCacheBust<T>(loader: () => Promise<T>): Promise<T> {
    const url = getImportUrl(loader);
    if (url) {
        url.searchParams.set('retry_t', Date.now().toString());
        const c = await import(/* @vite-ignore */ url.href);
        return 'default' in c ? c.default : c;
    }

    return loader();
}

/**
 * Load something asynchronously (typically a dynamic `import()`), retrying transient
 * module loading failures with exponential backoff. From the second retry onwards a
 * loading toast is shown to indicate a network issue to the user.
 *
 * Inspired by the retry behaviour in NetworkManager.
 */
export const importWithRetry: ImportRetryMethod = async <Args extends unknown[], T>(loader: (...args: Args) => Promise<T> | T, args: Args): Promise<T> => {
    let toast: Toast | null = null;

    try {
        for (let attempt = 1; ; attempt++) {
            try {
                // From the second attempt on, bypass the browser's module cache (see
                // reimportWithCacheBust), otherwise a failed import keeps returning its
                // cached rejection and the retry can never recover.
                if (attempt > 1) {
                    // This is a bit hacky,
                    // but we'll only retry this once to catch most temporary network issues
                    // if that still fails we'll reload the page - that fixes the issue with
                    // loading issues of dependenices of the imported file, which we cannot retry sadly
                    return await reimportWithCacheBust(loader as () => Promise<T>);
                }
                return await loader(...args);
            } catch (e) {
                console.error(e);
                // Only retry transient module loading errors, and only up to the maximum number of attempts.
                if (attempt >= MAX_IMPORT_ATTEMPTS || !isModuleImportError(e)) {
                    throw e;
                }

                const url = getImportUrl(loader)?.href;

                if (url && attempt <= 5) {
                    const message = e instanceof Error ? e.message : String(e);
                    if (message.includes(url)) {
                        // Only now we can retry.
                        // otherwise the error will be caused by an subdependency, which is not retryable

                        // From the second retry onwards (i.e. after at least two failed attempts),
                        // indicate the network issue to the user with a loading spinner.
                        if (attempt >= 2 && !toast) {
                            toast = new Toast($t(`%ks`), 'spinner').setHide(null).show();
                        }

                        // Exponential backoff with a bit of jitter, capped at 10 seconds.
                        const delay = Math.min(1_000 + 2 ** (attempt - 1) * 500, 10 * 1000);
                        const jitter = Math.random() * 250;
                        await sleep(delay + jitter);

                        // Retry
                        continue;
                    } else {
                        console.info('Import failed for a subdependency. Expected ', url, ' found ', message);
                    }
                }
                console.error('Failed to load dynamically imported module - not possible to retry', e);
                toast = new Toast($t(`%ks`), 'spinner').setHide(null).show();

                // Wait for stable URL before reloading
                // + also good to give some time for the network to restore
                // so the reload has more chance to work
                await sleep(1_000);
                window.location.reload();
                throw e;
            }
        }
    } finally {
        if (toast) {
            toast.hide();
        }
    }
};

/**
 * Decide what to show when loading a component ultimately fails (after the automatic retries).
 * For transient module loading errors we resolve to a dedicated error view with a manual retry
 * button — so the user can recover without losing their place — instead of failing. Other errors
 * keep the existing toast + rethrow behaviour.
 */
function handleLoadError(error: unknown, load: () => Promise<ComponentWithProperties>): ComponentWithProperties {
    if (isModuleImportError(error)) {
        return new ComponentWithProperties(ImportErrorView, { load });
    }
    throw error;
}

/**
 * In the app, we don't need to wait for components to load (because they are present).
 * So pass the promise to prevent DOM updates
 */
export async function LoadComponent(component: () => Promise<any>, properties = {}, settings?: { instant: boolean }) {
    const load = async () => {
        const c = (await importWithRetry(component, []));
        return new ComponentWithProperties('default' in c ? c.default : c, properties);
    };

    try {
        if (settings?.instant) {
            return AsyncComponent(component, properties);
        }
        if (!AppManager.shared.isNative) {
            // Instead of initiating a loading dom, we can wait maximum 50ms
            // for the promise to resolve and decide if we need to show the loading dom or not
            const promise = importWithRetry(component, []);
            const speedRun = sleep(50).then(() => null);
            const result = await Promise.any([promise, speedRun]);

            if (result === null) {
                return new ComponentWithProperties(PromiseView, {
                    promise: async function () {
                        try {
                            const c = (await promise);
                            return new ComponentWithProperties('default' in c ? c.default : c, properties);
                        } catch (e) {
                            return handleLoadError(e, load);
                        }
                    },
                });
            }
            return new ComponentWithProperties(result.default, properties);
        }
        const c = (await importWithRetry(component, []));
        return new ComponentWithProperties('default' in c ? c.default : c, properties);
    } catch (e) {
        return handleLoadError(e, load);
    }
}

export function PromiseComponent(component: () => Promise<ComponentWithProperties>) {
    return new ComponentWithProperties(PromiseView, {
        promise: async function () {
            try {
                return await component();
            } catch (e) {
                return handleLoadError(e, component);
            }
        },
    });
}

export function AsyncComponent(
    component: () => Promise<any>,
    properties = {},
    options?: ConstructorParameters<typeof ComponentWithProperties>[2],
) {
    const load = async () => {
        const c = (await importWithRetry(component, []));
        return new ComponentWithProperties('default' in c ? c.default : c, properties, options);
    };
    return PromiseComponent(load);
}
