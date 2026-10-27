import type { AutoEncoder, AutoEncoderPatchType, PartialWithoutMethods, PatchType } from '@common/encoding';
import { patchContainsChanges } from '@common/encoding';
import { Version } from '@stamhoofd/structures';
import type { Ref } from 'vue';
import { computed, ref, unref } from 'vue';

/**
 * Accumulate edits separately from an AutoEncoder and expose a computed patched copy.
 * Pass a ref to follow replacement of the source; getters are not accepted. An
 * initial value is required. Source replacement does not reset accumulated edits.
 * `addPatch` applies newer edits last; `addDependingPatch` lets existing edits win.
 * `reset` creates an empty patch for the current source (including its id).
 * `postProcess` transforms each computed patched copy, not the stored patch.
 */
export function usePatch<T extends AutoEncoder>(obj: T | Ref<T>, options?: {
    postProcess?: (obj: T) => T;
}): {
    createPatch: () => AutoEncoderPatchType<T>;
    patched: Ref<T>;
    patch: Ref<AutoEncoderPatchType<T>>;
    addPatch: (newPatch: PartialWithoutMethods<AutoEncoderPatchType<T>>) => void;
    addDependingPatch: (newPatch: PartialWithoutMethods<AutoEncoderPatchType<T>>) => void;
    hasChanges: Ref<boolean>;
    reset: () => void;
} {
    const initialValue = unref(obj);
    if (!initialValue) {
        throw new Error('Expected a reference with an initial value at usePatch');
    }
    const patch = ref('id' in initialValue ? (initialValue.static as any).patch({ id: initialValue.id }) : initialValue.static.patch({})) as Ref<AutoEncoderPatchType<T>>;

    const createPatch = () => {
        const iv = unref(obj);
        return ('id' in iv ? (iv.static as any).patch({ id: iv.id }) : iv.static.patch({})) as AutoEncoderPatchType<T>;
    };

    return {
        createPatch,
        patch,
        patched: computed(() => {
            const o = unref(obj).patch(patch.value);
            if (options?.postProcess) {
                return options.postProcess(o);
            }

            return o;
        }),
        addPatch: (newPatch: PartialWithoutMethods<AutoEncoderPatchType<T>>) => {
            patch.value = patch.value.patch(unref(obj).static.patch(newPatch));
        },
        addDependingPatch: (newPatch: PartialWithoutMethods<AutoEncoderPatchType<T>>) => {
            patch.value = (unref(obj).static.patch(newPatch) as AutoEncoderPatchType<T>).patch(patch.value);
        },
        hasChanges: computed(() => {
            return patchContainsChanges(patch.value as PatchType<T>, unref(obj), { version: Version });
        }),
        reset: () => {
            patch.value = createPatch();
        },
    };
}
