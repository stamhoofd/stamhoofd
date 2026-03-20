import { usePlatformManager } from '@stamhoofd/networking';
import type { Platform } from '@stamhoofd/structures';
import type { Ref} from 'vue';
import { computed } from 'vue';

export function usePlatform(): Ref<Platform> {
    const platformManager = usePlatformManager();
    return computed(() => platformManager.value.$platform)
}
