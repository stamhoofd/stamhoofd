import { LoginMethod } from '@stamhoofd/structures';
import { Ref, computed } from 'vue';
import { usePlatform } from './usePlatform';

export function useLoginMethods(): Ref<LoginMethod[]> {
    const platform = usePlatform();
    return computed(() => {
        if (STAMHOOFD.userMode === 'platform') {
            return platform.value.config.loginMethods;
        }
        return [LoginMethod.Password];
    });
}

export function useLoginMethod(method: LoginMethod): Ref<boolean> {
    const loginMethods = useLoginMethods();
    return computed(() => loginMethods.value.includes(method));
}
