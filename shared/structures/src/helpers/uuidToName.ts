import type { Platform } from '../Platform.js';

/**
 * Resolves a uuid to a human readable name using the platform configuration.
 *
 * This takes the platform explicitly instead of reading a global. Callers that cannot pass one
 * (AuditLogReplacement renders uuids from a bare id) go through the
 * AuditLogReplacementDependencies.uuidToName injection slot, which the api and the frontend each
 * fill in with a resolver bound to their own platform.
 */
export function uuidToName(uuid: string, platform: Platform) {
    // Look up in UUID library list
    const objectLists
     = [
         platform.config.premiseTypes,
         platform.config.eventTypes,
         platform.config.defaultAgeGroups,
         platform.config.tags,
         platform.config.recordsConfiguration.recordCategories,
         platform.config.membershipTypes,
         platform.config.responsibilities,
         platform.privateConfig?.roles ?? [],

     ];

    for (const list of objectLists) {
        for (const object of list) {
            if (object.id === uuid) {
                return object.name.toString();
            }
        }
    }
    return null;
}
