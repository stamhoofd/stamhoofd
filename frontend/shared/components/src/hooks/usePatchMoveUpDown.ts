import { AutoEncoder, NonScalarIdentifiable, PatchableArray, PatchableArrayAutoEncoder } from "@simonbackx/simple-encoding";
import { Ref, unref } from "vue";

export function usePatchMoveUpDown<T extends AutoEncoder & NonScalarIdentifiable<any>>(
    movingItemId: string|number,
    inList: Ref<T[]>|T[],
    addPatch: (arrPatch: PatchableArrayAutoEncoder<T>) => void,
) {
    return {
        up: () => {
            const list = unref(inList)
            const index = list.findIndex(c => c.id === movingItemId)
            if (index == -1 || index == 0) {
                return;
            }
    
            const moveTo = index - 2 
            const p = new PatchableArray() as PatchableArrayAutoEncoder<T>
            p.addMove(movingItemId, list[moveTo]?.id ?? null)
            addPatch(p)
        }, 
        down: () => {
            const list = unref(inList)
            const index = list.findIndex(c => c.id === movingItemId)
            if (index == -1 || index >= list.length - 1) {
                return;
            }
    
            const moveTo = index + 1
            const p = new PatchableArray() as PatchableArrayAutoEncoder<T>
            p.addMove(movingItemId, list[moveTo]?.id ?? null)
            addPatch(p)
        }
    }
}
