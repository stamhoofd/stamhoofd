import { AutoEncoder, NonScalarIdentifiable, AutoEncoderPatchType, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { Ref, computed } from 'vue';
import { usePatchableArray } from './usePatchableArray';

export function useEmitPatchArray<Props, PropName extends string & keyof Props, T extends AutoEncoder & NonScalarIdentifiable<any>>(props: Props, emit: ((d: `patch:${PropName}`, value: PatchableArrayAutoEncoder<T>) => unknown), propName: PropName): {
    addArrayPatch: (newPatch: PatchableArrayAutoEncoder<T>) => void;
    addPatch: (newPatch: AutoEncoderPatchType<T>) => void;
    addPut: (p: T) => void;
    addDelete: (id: string) => void;
    patched: Ref<T[]>;
} {
    const addArrayPatch = (newPatch: PatchableArrayAutoEncoder<T>) => {
        emit(('patch:' + propName) as `patch:${PropName}`, newPatch);
    };

    const { addPatch, addPut, addDelete } = usePatchableArray(addArrayPatch);

    return {
        addArrayPatch,
        addPatch,
        addPut,
        addDelete,
        patched: computed(() => props[propName]) as Ref<T[]>,
    };
}
