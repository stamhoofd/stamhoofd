import type { Platform } from '@stamhoofd/structures';
import type { Ref } from 'vue';
import { computed } from 'vue';
import { useContext } from './useContext';

export function usePlatform(): Ref<Platform> {
    const context = useContext();
    return computed(() => context.value.platform);
}
