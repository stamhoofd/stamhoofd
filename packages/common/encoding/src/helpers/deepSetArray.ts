import { getOptionalId } from '../classes/Identifiable.js';
import { deepSet } from './deepSet.js';

export function deepSetArray(oldArray: any[], newArray: any[], options?: { keepMissing?: boolean }) {
    if (oldArray === newArray) {
        // Same reference: nothing to do
        // Note: this does not catch all situations (e.g. proxies)
        return oldArray;
    }

    const copiedArray = (oldArray as any[]).slice();

    // Loop old array
    // Keep array reference
    // Delete deleted items
    // Add new items
    // Copy over changes from updated items
    // Maintain new order

    // This might look like a waste of resources, but is essential
    // as newArray and oldArray might reference the same array, but with proxy logic in between
    // to prevent clearing out newArray, we need a copy here
    const loop = newArray.slice();

    // Clear out old array
    oldArray.splice(0, oldArray.length);

    for (const newItem of loop) {
        if (newItem && typeof newItem === 'object' && !Array.isArray(newItem)) {
            const oldItem = copiedArray.find(i => getOptionalId(i) === getOptionalId(newItem));
            if (oldItem !== undefined) {
                oldArray.push(deepSet(oldItem, newItem, { replaceOnIdChange: true }));
            }
            else {
                oldArray.push(newItem);
            }
        }
        else {
            oldArray.push(newItem);
        }
    }

    if (options?.keepMissing) {
        // Readd old missing items
        for (const oldItem of copiedArray) {
            const found = oldArray.find(i => getOptionalId(i) === getOptionalId(oldItem));

            if (!found) {
                oldArray.push(oldItem);
            }
        }
    }

    return oldArray;
}
