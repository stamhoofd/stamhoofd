import type { AutoEncoder, AutoEncoderPatchType, PartialWithoutMethods } from '@simonbackx/simple-encoding';
import type { Ref} from 'vue';
import { computed } from 'vue';

export function useEmitPatch<T extends AutoEncoder>(props: any, emit: any, propName: string): {
    createPatch: () => AutoEncoderPatchType<T>;
    patched: Ref<T>;
    addPatch: (newPatch: PartialWithoutMethods<AutoEncoderPatchType<T>>) => void;
} {
    const createPatch = () => {
        return (props[propName] && 'id' in props[propName] ? props[propName].static.patch({ id: props[propName].id }) : props[propName].static.patch({})) as AutoEncoderPatchType<T>;
    };

    return {
        createPatch,
        patched: computed(() => props[propName]) as Ref<T>,
        addPatch: (newPatch: PartialWithoutMethods<AutoEncoderPatchType<T>>) => {
            if (!props[propName]) {
                emit('patch:' + propName, newPatch);
                return;
            }
            emit('patch:' + propName, createPatch().patch(props[propName].static.patch(newPatch)));
        },
    } as any;
}
