import type { AutoEncoder, AutoEncoderPatchType, PartialWithoutMethods } from '@common/encoding';
import type { Ref} from 'vue';
import { computed } from 'vue';

/**
 * Read the parent's current prop and emit edits as `patch:<propName>` events.
 * Does not accumulate or apply edits locally; the parent owns that state.
 * Includes the current object's id when creating patches, when present.
 */
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
