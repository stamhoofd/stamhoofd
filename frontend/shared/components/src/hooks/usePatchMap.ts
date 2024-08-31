import { AutoEncoder, isPatch, patchContainsChanges, PatchMap, PatchType } from "@simonbackx/simple-encoding";
import { Version } from "@stamhoofd/structures";
import { computed, ref, Ref, unref } from "vue";

export function usePatchMap<K, V extends AutoEncoder>(obj: Map<K, V>|Ref<Map<K, V>>): {
    patched: Ref<Map<K, V>>, 
    patch: Ref<PatchMap<K, V>>,
    addPut: (key: K, value: V) => void,
    addDelete: (key: K) => void,
    hasChanges: Ref<boolean>
} {
    const patch = ref(new PatchMap()) as Ref<PatchMap<K, V>>;

    return {
        patch,
        patched: computed(() => {
            return patch.value.applyTo(unref(obj)) as Map<K, V>
        }),
        addPut: (key: K, value: V) => {
            patch.value.set(key, value)
        },
        addDelete: (key: K) => {
            patch.value.set(key, null as unknown as V);
        },
        // not tested yet
        hasChanges: computed(() => {
            const map = unref(obj);
            const patchMap = patch.value;
            
            if(map.size !== patchMap.size) {
                return true;
            }

            for(const [key, value] of map) {
                const originalValue = map.get(key);

                // is patch
                if(originalValue && isPatch(value) && patchContainsChanges(value as PatchType<V>, originalValue, { version: Version })) {
                    return true;
                }

                // is put
                if(value !== originalValue) {
                    return true;
                }
            }

            return false;
        })
    }
}
