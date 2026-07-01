import { LoginMethod, LoginMethodConfig } from '@stamhoofd/structures';
import type { Ref } from 'vue';
import { computed } from 'vue';
import { useOrganization } from './useOrganization';
import { usePlatform } from './usePlatform';
import { useUser } from './useUser';

export function useLoginMethods(): Ref<Map<LoginMethod, LoginMethodConfig>> {
    const platform = usePlatform();
    const organization = useOrganization();
    const user = useUser();

    return computed(() => {
        if (!organization.value || STAMHOOFD.userMode === 'platform' || (user.value && user.value.organizationId === null)) {
            return platform.value.config.loginMethods;
        }
        return organization.value?.meta.loginMethods ?? new Map<LoginMethod, LoginMethodConfig>([[LoginMethod.Password, LoginMethodConfig.create({})]]);
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
