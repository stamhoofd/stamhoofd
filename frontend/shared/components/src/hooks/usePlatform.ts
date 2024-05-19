import { usePlatformManager } from "@stamhoofd/networking";
import { Platform } from "@stamhoofd/structures";
import { Ref, computed } from "vue";

export function usePlatform(): Ref<Platform> {
    const platformManager = usePlatformManager();
    return computed(() => platformManager.value.$platform)
}
