import { AutoEncoder, AutoEncoderPatchType, PartialWithoutMethods, patchContainsChanges, PatchType } from '@simonbackx/simple-encoding';
import { Version } from '@stamhoofd/structures';
import { computed, Ref, ref, unref } from 'vue';

export function usePatch<T extends AutoEncoder>(obj: T | Ref<T>): {
    createPatch: () => AutoEncoderPatchType<T>;
    patched: Ref<T>;
    patch: Ref<AutoEncoderPatchType<T>>;
    addPatch: (newPatch: PartialWithoutMethods<AutoEncoderPatchType<T>>) => void;
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
            return unref(obj).patch(patch.value);
        }),
        addPatch: (newPatch: PartialWithoutMethods<AutoEncoderPatchType<T>>) => {
            patch.value = patch.value.patch(unref(obj).static.patch(newPatch));
        },
        hasChanges: computed(() => {
            return patchContainsChanges(patch.value as PatchType<T>, unref(obj), { version: Version });
        }),
        reset: () => {
            patch.value = createPatch();
        },
    };
}
