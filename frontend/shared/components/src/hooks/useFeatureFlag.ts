import { Organization, Platform } from '@stamhoofd/structures';
import { useOrganization } from './useOrganization';
import { usePlatform } from './usePlatform';

export function useFeatureFlag(): (flag: string) => boolean {
    const organization = useOrganization();
    const platform = usePlatform();

    return (flag: string) => {
        if (platform.value?.config.featureFlags.includes(flag)) {
            return true;
        }
        return organization.value?.privateMeta?.featureFlags.includes(flag) ?? false;
    };
}

export function manualFeatureFlag(flag: string, organization?: Organization | null): boolean {
    if (Platform.shared.config.featureFlags.includes(flag)) {
        return true;
    }
    return organization?.privateMeta?.featureFlags.includes(flag) ?? false;
}
