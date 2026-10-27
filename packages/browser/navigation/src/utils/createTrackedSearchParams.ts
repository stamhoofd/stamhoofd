/* eslint-disable @typescript-eslint/no-unsafe-function-type */
/**
 * Wraps a URLSearchParams instance in a Proxy that records which keys
 * were read via `get`, `getAll`, or `has`. Iteration (entries, keys,
 * values, forEach, spread) marks every present key as read, since the
 * caller observed all of them.
 *
 * Note: methods are bound to the underlying target, not the proxy.
 * URLSearchParams relies on internal slots, so calling its methods with
 * a Proxy as `this` would throw a TypeError.
 */

export interface TrackedSearchParams {
    /** Drop-in replacement for the original URLSearchParams. */
    params: URLSearchParams;
    /** Live, read-only view of the keys read so far. */
    readKeys: ReadonlySet<string>;
    /** Snapshot of the keys read so far, as an array. */
    getReadKeys(): string[];
    /** Keys present in the params that were never read. */
    getUnreadKeys(): string[];
    /** Clear the tracking state (e.g. between requests in a pool). */
    reset(): void;
}

const KEY_READING_METHODS = new Set(['get', 'getAll', 'has']);
const FULL_SCAN_METHODS = new Set(['entries', 'keys', 'values', 'forEach', 'toString']);

export function createTrackedSearchParams(
    source: URLSearchParams | string | Record<string, string>,
): TrackedSearchParams {
    const target
    = source instanceof URLSearchParams ? source : new URLSearchParams(source);

    const readKeys = new Set<string>();

    const markAll = () => {
        for (const key of target.keys()) readKeys.add(key);
    };

    const proxy = new Proxy(target, {
        get(t, prop, _receiver) {
            // Iteration via spread / for..of observes everything.
            if (prop === Symbol.iterator) {
                markAll();
                return t[Symbol.iterator].bind(t);
            }

            const value = Reflect.get(t, prop);

            if (typeof value !== 'function') {
                // e.g. `size` — observes count, not specific keys; leave untracked.
                return value;
            }

            const name = typeof prop === 'string' ? prop : '';

            if (KEY_READING_METHODS.has(name)) {
                return (key: string, ...rest: unknown[]) => {
                    readKeys.add(key);
                    return (value as Function).call(t, key, ...rest);
                };
            }

            if (FULL_SCAN_METHODS.has(name)) {
                return (...args: unknown[]) => {
                    markAll();
                    return (value as Function).apply(t, args);
                };
            }

            // Mutators (set, append, delete, sort) and anything else pass through,
            // bound to the real target so internal slots resolve correctly.
            return value.bind(t);
        },
    });

    return {
        params: proxy,
        readKeys,
        getReadKeys: () => [...readKeys],
        getUnreadKeys: () => [...target.keys()].filter(k => !readKeys.has(k)),
        reset: () => readKeys.clear(),
    };
}
