import { AutoEncoder, AutoEncoderPatchType, PartialWithoutMethods } from "@simonbackx/simple-encoding";
import { Ref, computed } from "vue";

export function useEmitPatch<T extends AutoEncoder>(props: any, emit: any, propName: string): { 
    createPatch: () => AutoEncoderPatchType<T>,
    patched: Ref<T>, 
    addPatch: (newPatch: PartialWithoutMethods<AutoEncoderPatchType<T>>) => void 
} {
    const createPatch = () => {
        return ("id" in props[propName] ? props[propName].static.patch({id: props[propName].id}) : props[propName].static.patch({})) as AutoEncoderPatchType<T>;
    }

    return {
        createPatch,
        patched: computed(() => props[propName]) as Ref<T>,
        addPatch: (newPatch: PartialWithoutMethods<AutoEncoderPatchType<T>>) => {
            emit('patch:' + propName, createPatch().patch(props[propName].static.patch(newPatch)))
        }
    } as any
}
