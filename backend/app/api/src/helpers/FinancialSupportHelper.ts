import type { Organization, Platform } from '@stamhoofd/models';
import type { FinancialSupportSettings, Organization as OrganizationStruct, Platform as PlatformStruct } from '@stamhoofd/structures';

/**
 * Get the financial support settings from the platform if userMode is platform, or from the organization otherwise.
 * @param platform
 * @param getOrganization callback to prevent fetching the organization if not needed
 * @returns
 */
export async function getFinancialSupportSettingsAsync(platform: Platform | PlatformStruct, getOrganization: () => Promise<Organization | OrganizationStruct | null>): Promise<FinancialSupportSettings | null> {
    if (STAMHOOFD.userMode === 'platform') {
        return platform.config.financialSupport;
    }

    const organization = await getOrganization();
    if (organization) {
        return organization.meta.financialSupport;
    }

    return null;
}
