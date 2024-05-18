import { AutoEncoder, NonScalarIdentifiable, PatchableArrayAutoEncoder, PatchableArray } from "@simonbackx/simple-encoding";
import { computed } from "vue";

export function useDraggableArray<T extends AutoEncoder & NonScalarIdentifiable<any>>(getter: () => T[], addPatch: (newPatch: PatchableArrayAutoEncoder<T>) => void) {
    return computed({
        get: getter,
        set: (records: T[]) => {
            // Create move patch
            const recordsPatch = new PatchableArray() as PatchableArrayAutoEncoder<T>
            const original = getter()
            
            for (const record of records.slice().reverse()) {
                if (!record) {
                    console.warn('Received undefined value in draggable patch')
                    continue;
                }

                // Check if records exists
                if (original.find(o => o.id === record.id)) {
                    recordsPatch.addMove(record.id, null)
                } else {
                    // This is a new one (happens when dragging between lists)
                    recordsPatch.addPut(record.id, null)
                }
            }

            // Check deleted
            for (const r of original) {
                if (!records.find(rr => rr.id === r.id)) {
                    recordsPatch.addDelete(r.id)
                }
            }

            addPatch(recordsPatch)
        }
    });
}
