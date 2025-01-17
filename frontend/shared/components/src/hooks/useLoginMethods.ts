import { LoginMethod, LoginMethodConfig } from '@stamhoofd/structures';
import { Ref, computed } from 'vue';
import { usePlatform } from './usePlatform';

export function useLoginMethods(): Ref<Map<LoginMethod, LoginMethodConfig>> {
    const platform = usePlatform();
    return computed(() => {
        if (STAMHOOFD.userMode === 'platform') {
            return platform.value.config.loginMethods;
        }
        return new Map<LoginMethod, LoginMethodConfig>([[LoginMethod.Password, LoginMethodConfig.create({})]]);
    });
}

export function useLoginMethod(method: LoginMethod): Ref<LoginMethodConfig | null> {
    const loginMethods = useLoginMethods();
    return computed(() => loginMethods.value.get(method) ?? null);
}

export function useLoginMethodEnabled(email: Ref<string> | string, method: LoginMethod): Ref<boolean> {
    const loginMethod = useLoginMethod(method);
    return computed(() => {
        if (!loginMethod.value) {
            return false;
        }
        return loginMethod.value.isEnabledForEmail(typeof email === 'string' ? email : email.value);
    });
}
