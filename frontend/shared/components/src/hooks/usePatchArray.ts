import { AutoEncoder, NonScalarIdentifiable, PatchableArrayAutoEncoder, AutoEncoderPatchType, PatchableArray } from "@simonbackx/simple-encoding"
import { ref, Ref, computed, unref } from "vue"

export function usePatchArray<T extends AutoEncoder & NonScalarIdentifiable<any>>(obj: T[]|Ref<T[]>): {
    patched: Ref<T[]>, 
    patch: Ref<PatchableArrayAutoEncoder<T>>,
    addArrayPatch: (newPatch: PatchableArrayAutoEncoder<T>) => void,
    addPatch: (newPatch: AutoEncoderPatchType<T>) => void,
    addPut: (p: T) => void,
    addDelete: (id: string) => void,
    hasChanges: Ref<boolean>
} {
    const patch = ref(new PatchableArray()) as Ref<PatchableArrayAutoEncoder<T>>

    return {
        patch,
        patched: computed(() => {
            return patch.value.applyTo(unref(obj)) as T[]
        }),
        addArrayPatch: (newPatch: PatchableArrayAutoEncoder<T>) => {
            patch.value = patch.value.patch(newPatch)
        },
        addPatch: (newPatch: AutoEncoderPatchType<T>) => {
            patch.value.addPatch(newPatch)
        },
        addPut: (p: T) => {
            patch.value.addPut(p)
        },
        addDelete: (id: string) => {
            patch.value.addDelete(id)
        },
        hasChanges: computed(() => {
            return patch.value.changes.length > 0
        })
    }
}
