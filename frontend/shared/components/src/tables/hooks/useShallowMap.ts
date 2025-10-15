import { shallowRef, triggerRef } from 'vue';

export function useShallowMap<K, V>(initialEntries = []) {
    const mapRef = shallowRef(new Map<K, V>(initialEntries));

    function set(key: K, value: V) {
        mapRef.value.set(key, value);
        triggerRef(mapRef); // notify Vue about the change
    }

    function deleteKey(key: K) {
        const deleted = mapRef.value.delete(key);
        if (deleted) triggerRef(mapRef);
        return deleted;
    }

    function clear() {
        if (mapRef.value.size > 0) {
            mapRef.value.clear();
            triggerRef(mapRef);
        }
    }

    return {
        map: mapRef,
        set,
        delete: deleteKey,
        clear,
        get value() {
            return mapRef.value;
        },
        set value(v: Map<K, V>) {
            mapRef.value = v;
            triggerRef(mapRef);
        },
        get size() {
            return mapRef.value.size;
        },
    };
}
