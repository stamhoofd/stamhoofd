import { AutoEncoder, NonScalarIdentifiable, PatchableArrayAutoEncoder, AutoEncoderPatchType, PatchableArray } from "@simonbackx/simple-encoding"

export function usePatchableArray<T extends AutoEncoder & NonScalarIdentifiable<string|number>>(patchArray: (array: PatchableArrayAutoEncoder<T>) => void) {
    return {
        addPatch: (patch: AutoEncoderPatchType<T>) => {
            if (!patch.id) {
                throw new Error('Expected a patch with an id at usePatchItemInArray.patchItem for ' + patch)
            }
            const arr = new PatchableArray() as PatchableArrayAutoEncoder<T>
            arr.addPatch(patch)
            patchArray(arr)
        }
    }
}
