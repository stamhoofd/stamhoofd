import type { Organization } from '../Organization.js';
import type { Platform } from '../Platform.js';

/**
 * Hides the judicial record feature while it is being built: the platform turns it on for itself, or an
 * organization turns it on for its own dashboard, the same way every other feature flag works.
 */
export const judicialRecordFeatureFlag = 'judicial-record';

export function hasJudicialRecordFeature({
    platform,
    organization,
}: {
    platform: Platform;
    organization?: Organization | null;
}): boolean {
    if (platform.config.featureFlags.includes(judicialRecordFeatureFlag)) {
        return true;
    }

    return organization?.privateMeta?.featureFlags.includes(judicialRecordFeatureFlag) ?? false;
}
