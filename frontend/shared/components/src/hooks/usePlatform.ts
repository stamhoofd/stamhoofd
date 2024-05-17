import { Platform } from "@stamhoofd/structures";
import { Ref, inject, toRef } from "vue";

export function usePlatform(): Ref<Platform> {
    return toRef(inject('$platform') as Platform) as Ref<Platform>
}
