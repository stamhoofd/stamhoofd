import type { SessionContext } from '@stamhoofd/networking/SessionContext';
import { Organization, OrganizationPrivateMetaData, Platform } from '@stamhoofd/structures';
import { usePatchOrganization } from '../organizations/usePatchOrganization';
import { useContext } from './useContext';
import { useOrganization } from './useOrganization';
import { usePlatform } from './usePlatform';

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

export function useSetFeatureFlag(): (flag: string, value: boolean) => Promise<void> {
    const patch = usePatchOrganization();

    return async (flag: string, value: boolean) => {
        const privateMeta = OrganizationPrivateMetaData.patch({});

        if (value) {
            // First delete to prevent duplications
            privateMeta.featureFlags.addDelete(flag);
            privateMeta.featureFlags.addDelete(flag);
            privateMeta.featureFlags.addPut(flag);
        } else {
            privateMeta.featureFlags.addDelete(flag);
            privateMeta.featureFlags.addDelete(flag);
        }

        return await patch(Organization.patch({
            privateMeta,
        }), {
            shouldRetry: false,
        });
    };
}
