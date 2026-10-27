import { deepSet } from './deepSet.js';

export function deepSetMap(oldMap: Map<unknown, unknown>, newMap: Map<unknown, unknown>) {
    if (oldMap === newMap) {
        // Note: this does not catch all situations (e.g. proxies)
        return oldMap;
    }

    const copiedMap = new Map(oldMap);

    for (const [key, value] of newMap.entries()) {
        const baseValue = copiedMap.get(key);
        // Prevent recursive updates
        newMap.set(key, baseValue);
        const setValue = deepSet(baseValue, value, { replaceOnIdChange: true });
        oldMap.set(key, setValue);

        if (setValue !== baseValue) {
            newMap.set(key, setValue);
        }
    }

    // Remove deleted keys
    // don't use clear - as oldMap and newMap could still reference the same map in rare situations (Vue + reactivity frameworks)
    for (const [oldKey] of oldMap.entries()) {
        if (!newMap.has(oldKey)) {
            oldMap.delete(oldKey);
        }
    }

    return oldMap;
}
