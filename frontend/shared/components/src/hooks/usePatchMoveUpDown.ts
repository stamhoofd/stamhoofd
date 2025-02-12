import { AutoEncoder, NonScalarIdentifiable, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { computed, Ref, unref } from 'vue';

export function usePatchMoveUpDown<T extends AutoEncoder & NonScalarIdentifiable<any>>(
    inList: Ref<T[]> | T[],
    addPatch: (arrPatch: PatchableArrayAutoEncoder<T>) => void,
) {
    return {
        up: (movingItemId: string | number) => {
            const list = unref(inList);
            const index = list.findIndex(c => c.id === movingItemId);
            if (index === -1 || index === 0) {
                return;
            }

            const moveTo = index - 2;
            const p = new PatchableArray() as PatchableArrayAutoEncoder<T>;
            p.addMove(movingItemId, list[moveTo]?.id ?? null);
            addPatch(p);
        },
        down: (movingItemId: string | number) => {
            const list = unref(inList);
            const index = list.findIndex(c => c.id === movingItemId);
            if (index === -1 || index >= list.length - 1) {
                return;
            }

            const moveTo = index + 1;
            const p = new PatchableArray() as PatchableArrayAutoEncoder<T>;
            p.addMove(movingItemId, list[moveTo]?.id ?? null);
            addPatch(p);
        },
        canMoveUp: (movingItemId: string | number) => {
            const list = unref(inList);
            const index = list.findIndex(c => c.id === movingItemId);
            return index > 0;
        },
        canMoveDown: (movingItemId: string | number) => {
            const list = unref(inList);
            const index = list.findIndex(c => c.id === movingItemId);
            return index !== -1 && index < list.length - 1;
        },
    };
}

export function usePatchMoveUpDownSingle<T extends AutoEncoder & NonScalarIdentifiable<any>>(
    movingItemId: string | number,
    inList: Ref<T[]> | T[],
    addPatch: (arrPatch: PatchableArrayAutoEncoder<T>) => void,
) {
    const d = usePatchMoveUpDown(inList, addPatch);

    return {
        up: () => {
            d.up(movingItemId);
        },
        down: () => {
            d.down(movingItemId);
        },
        canMoveUp: computed(() => {
            return d.canMoveUp(movingItemId);
        }),
        canMoveDown: computed(() => {
            return d.canMoveDown(movingItemId);
        }),
    };
}

export function usePatchMoveUpDownIds<T extends string | number>(
    movingItemId: T,
    inList: Ref<T[]> | T[],
    addPatch: (arrPatch: PatchableArray<T, T, T>) => void,
) {
    return {
        up: () => {
            const list = unref(inList);
            const index = list.findIndex(c => c === movingItemId);
            if (index == -1 || index == 0) {
                return;
            }

            const moveTo = index - 2;
            const p = new PatchableArray() as PatchableArray<T, T, T>;
            p.addMove(movingItemId, list[moveTo] ?? null);
            addPatch(p);
        },
        down: () => {
            const list = unref(inList);
            const index = list.findIndex(c => c === movingItemId);
            if (index == -1 || index >= list.length - 1) {
                return;
            }

            const moveTo = index + 1;
            const p = new PatchableArray() as PatchableArray<T, T, T>;
            p.addMove(movingItemId, list[moveTo] ?? null);
            addPatch(p);
        },
    };
}
