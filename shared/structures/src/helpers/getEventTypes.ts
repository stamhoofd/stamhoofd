import type { Organization } from '../Organization.js';
import type { Platform } from '../Platform.js';
import { PlatformEventType } from '../Platform.js';

export function getEventTypes({ platform, organization }: { platform: Platform; organization: Organization | null }) {
    if (STAMHOOFD.userMode === 'platform') {
        return platform.config.eventTypes;
    }

    if (organization) {
        return organization.meta.eventTypes.map((type) => {
            return PlatformEventType.create({
                ...type,
            });
        });
    }

    return [];
}
