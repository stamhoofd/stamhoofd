import type { AutoEncoder, NonScalarIdentifiable, PatchableArrayAutoEncoder, AutoEncoderPatchType} from '@common/encoding';
import { PatchableArray } from '@common/encoding'

/** Forward each operation as a fresh array patch to a parent callback; `addPatch` requires a truthy id. */
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
