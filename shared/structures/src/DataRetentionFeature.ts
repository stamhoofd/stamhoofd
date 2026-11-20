export const DATA_RETENTION_FEATURE_FLAG = 'data-retention';

/**
 * Whether the data retention settings are available, for an organization or for the platform level (organizationFeatureFlags null).
 *
 * The platform has to allow it first. Within a platform, the terms of the platform apply to the data of every organization,
 * so every organization can see and extend them. In userMode organization there is no platform level, and an organization
 * only uses it after turning on its own flag.
 */
export function isDataRetentionEnabled({
    platformFeatureFlags,
    organizationFeatureFlags,
}: {
    platformFeatureFlags: string[];
    organizationFeatureFlags: string[] | null;
}): boolean {
    if (!platformFeatureFlags.includes(DATA_RETENTION_FEATURE_FLAG)) {
        return false;
    }
    if (STAMHOOFD.userMode === 'platform') {
        return true;
    }
    return organizationFeatureFlags?.includes(DATA_RETENTION_FEATURE_FLAG) ?? false;
}
