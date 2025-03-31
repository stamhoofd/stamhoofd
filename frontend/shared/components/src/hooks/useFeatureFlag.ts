import { Organization, Platform } from '@stamhoofd/structures';
import { useOrganization } from './useOrganization';
import { usePlatform } from './usePlatform';
import { useContext } from './useContext';
import { SessionContext } from '@stamhoofd/networking';

function checkFeatureFlag(flag: string, context: SessionContext, platform: Platform, organization?: Organization | null): boolean {
    if (platform.config.featureFlags.includes(flag)) {
        return true;
    }
    return organization?.privateMeta?.featureFlags.includes(flag) ?? false;
}

export function useFeatureFlag(): (flag: string) => boolean {
    const organization = useOrganization();
    const platform = usePlatform();
    const context = useContext();

    return (flag: string) => {
        return checkFeatureFlag(flag, context.value, platform.value, organization.value);
    };
}

export function manualFeatureFlag(flag: string, context: SessionContext, organization?: Organization | null): boolean {
    return checkFeatureFlag(flag, context, Platform.shared, organization ?? context.organization ?? null);
}
