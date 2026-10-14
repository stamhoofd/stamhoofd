import type { Organization } from '@stamhoofd/structures';
import { AppManager } from './AppManager';

/** Keep package eligibility separate from native review timing and presentation. */
export function markReviewMoment(organization: Organization | null) {
    const packages = organization?.meta.packages;
    const eligible = !packages || (packages.useMembers && !packages.isMembersTrial) || (packages.useWebshops && !packages.isWebshopsTrial);
    AppManager.shared.markReviewMoment({ eligible });
}
