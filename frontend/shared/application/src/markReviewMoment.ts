import type { Organization } from '@stamhoofd/structures';
import { AppManager } from '@stamhoofd/frontend-platform/AppManager';

/** Apply package eligibility before handing review timing to the native implementation. */
export function markReviewMoment(organization: Organization | null) {
    const packages = organization?.meta.packages;
    const eligible = !packages || (packages.useMembers && !packages.isMembersTrial) || (packages.useWebshops && !packages.isWebshopsTrial);
    AppManager.shared.markReviewMoment({ eligible });
}
