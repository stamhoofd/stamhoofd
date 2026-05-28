import { FinancialSupportSettings } from '../members/OrganizationRecordsConfiguration.js';
import type { Organization } from '../Organization.js';
import type { Platform } from '../Platform.js';

/**
 * Get the financial support settings from the platform if userMode is platform, or from the organization otherwise.
 * @param platform
 * @param organization
 * @returns
 */
export function getFinancialSupportSettings(platform: Platform, organization: Organization | null): FinancialSupportSettings | null {
    if (STAMHOOFD.userMode === 'platform') {
        return platform.config.financialSupport;
    }

    if (organization) {
        return organization.meta.financialSupport;
    }

    return null;
}

/**
 * Get the financial support settings from the platform if userMode is platform, or from the organization otherwise.
 * Returns default settings if no settings are found.
 * @param platform
 * @param organization
 * @returns
 */
export function getFinancialSupportSettingsOrDefault(platform: Platform, organization: Organization | null): FinancialSupportSettings {
    return getFinancialSupportSettings(platform, organization) ?? FinancialSupportSettings.create({});
}
