import type { AutoEncoder, NonScalarIdentifiable, PatchableArrayAutoEncoder, AutoEncoderPatchType} from '@simonbackx/simple-encoding';
import { PatchableArray } from '@simonbackx/simple-encoding'

export function usePatchableArray<T extends AutoEncoder & NonScalarIdentifiable<string|number>>(patchArray: (array: PatchableArrayAutoEncoder<T>) => void) {
    return {
        addPatch: (patch: AutoEncoderPatchType<T>) => {
            if (!patch.id) {
                throw new Error('Expected a patch with an id at usePatchItemInArray.patchItem')
            }
            const arr = new PatchableArray() as PatchableArrayAutoEncoder<T>
            arr.addPatch(patch)
            patchArray(arr)
        },

        addPut: (put: T, after?: string | number | null  ) => {
            const arr = new PatchableArray() as PatchableArrayAutoEncoder<T>
            arr.addPut(put, after)
            patchArray(arr)
        },

        addDelete: (id: string | number) => {
            const arr = new PatchableArray() as PatchableArrayAutoEncoder<T>
            arr.addDelete(id)
            patchArray(arr)
        }
    }
}
