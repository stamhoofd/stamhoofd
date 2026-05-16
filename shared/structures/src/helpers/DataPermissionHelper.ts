import { DataPermissionsSettings } from '../members/OrganizationRecordsConfiguration.js';
import type { Organization } from '../Organization.js';
import type { Platform } from '../Platform.js';

/**
 * Get the data permission settings from the platform if userMode is platform, or from the organization otherwise.
 * @param platform 
 * @param organization 
 * @returns 
 */
export function getDataPermissionSettings(platform: Platform, organization: Organization | null): DataPermissionsSettings | null {
    if (STAMHOOFD.userMode === 'platform') {
        return platform.config.dataPermission;
    }

    if (organization) {
        return organization.meta.dataPermission;
    }

    return null;
}

/**
 * Get the data permission settings from the platform if userMode is platform, or from the organization otherwise.
 * Returns default settings if no settings are found.
 * @param platform 
 * @param organization 
 * @returns 
 */
export function getDataPermissionSettingsOrDefault(platform: Platform, organization: Organization | null): DataPermissionsSettings {
    return getDataPermissionSettings(platform, organization) ?? DataPermissionsSettings.create({});
}
