import { ConvertArrayToPatchableArray, PatchMap, patchObject } from '@simonbackx/simple-encoding';
import { computed, ref, Ref, unref } from 'vue';

export function usePatchMap<K, T>(obj: Map<K, T> | Ref<Map<K, T>>): {
    patched: Ref<Map<K, T>>;
    patch: Ref<PatchMap<K, T | ConvertArrayToPatchableArray<T> | null>>;
    addMapPatch: (newPatch: PatchMap<K, T | ConvertArrayToPatchableArray<T> | null>) => void;
    addPatch: (key: K, newPatch: T | ConvertArrayToPatchableArray<T>) => void;
    addPut: (key: K, p: T) => void;
    addDelete: (key: K) => void;
    hasChanges: Ref<boolean>;
} {
    const patch = ref(new PatchMap()) as Ref<PatchMap<K, T | ConvertArrayToPatchableArray<T> | null>>;

    return {
        patch,
        patched: computed(() => {
            return patch.value.applyTo(unref(obj)) as Map<K, T>;
        }),
        addMapPatch: (newPatch: PatchMap<K, T | ConvertArrayToPatchableArray<T> | null>) => {
            patch.value = patchObject(patch.value, newPatch);
        },
        addPatch: (key: K, newPatch: T | ConvertArrayToPatchableArray<T>) => {
            patch.value = patchObject(patch.value, new PatchMap([[key, newPatch]]));
        },
        addPut: (key: K, p: T) => {
            patch.value.set(key, p);
        },
        addDelete: (key: K) => {
            patch.value.set(key, null);
        },
        hasChanges: computed(() => {
            return patch.value.size > 0;
        }),
    };
}
