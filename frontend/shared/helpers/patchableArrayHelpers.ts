import { AutoEncoder, AutoEncoderPatchType, PatchableArray } from "@simonbackx/simple-encoding";

/**
 * Create a PatchableArray containing patches for reordered items.
 * @param items the items in their new order
 * @param original the items in their original order
 * @param autoEncoder the AutoEncoder class that contains the PatchableArray
 * @param patchableArrayProperty  the property name of the PatchableArray in the AutoEncoder class
 * @returns the PatchableArray or null if the creation of the PatchableArray failed
 */
export function createPatchableArrayForReorder<A extends AutoEncoder, T extends {id: string}>
(items: T[] | undefined, original: T[] | undefined, autoEncoder: any & {patch: (value: any) => AutoEncoderPatchType<A>}, patchableArrayProperty: string): PatchableArray<any, T, any> | null {
    if(!items) {
        console.warn('Reorder failed: items are undefined.');
        return null;
    }

    if(items.length !== original?.length) {
        console.error('Reorder failed: length of reordered items does not match length of original.');
        return null;
    }

    const patch = autoEncoder.patch({});
    const patchableArray = patch[patchableArrayProperty];

    if(!(patchableArray instanceof PatchableArray)) {
        console.error(`Reorder failed: the value of the property '${patchableArrayProperty}' is not a PatchableArray.`)
        return null;
    }

    for(const item of items.slice().reverse()) {
        patchableArray.addMove(item.id, null);
    }

    return patchableArray;
}
