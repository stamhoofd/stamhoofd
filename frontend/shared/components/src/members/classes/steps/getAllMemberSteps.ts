import type { SessionContext } from '@stamhoofd/frontend-session/SessionContext';
import type { PlatformMember, RegisterItem } from '@stamhoofd/structures';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';
import type { EditMemberStep } from '../MemberStepManager';
import { MemberStepManager } from '../MemberStepManager';
import { MemberDataPermissionStep } from './MemberDataPermissionStep';
import { MemberEmergencyContactsStep } from './MemberEmergencyContactsStep';
import { MemberFinancialSupportStep } from './MemberFinancialSupportStep';
import { MemberGeneralStep } from './MemberGeneralStep';
import { MemberParentsStep } from './MemberParentsStep';
import { MemberRecordCategoryStep } from './MemberRecordCategoryStep';
import type { MemberSharedStepOptions } from './MemberSharedStepOptions';
import { MemberTaxCertificateStep } from './MemberTaxCertificateStep';
import { MemberUitpasStep } from './MemberUitpasStep';

const defaultOutdatedTime = 60 * 1000 * 60 * 24 * 31 * 3; // 3 months

export function getAllMemberSteps(member: PlatformMember, item: RegisterItem | null, options: MemberSharedStepOptions = { outdatedTime: defaultOutdatedTime }): EditMemberStep[] {
    const steps = [
        new MemberGeneralStep(options),
        new MemberDataPermissionStep(options),
        new MemberUitpasStep(options),
        new MemberFinancialSupportStep(options),
        new MemberParentsStep(options),
        new MemberTaxCertificateStep(options),
        new MemberEmergencyContactsStep(options),
    ];

    // We'll skip these steps for now for administrators - unless it is a requirement for the platform/owning organization is different
    // note: we don't use getEnabledRecordCategories, because this can change during the steps - so all possible steps should be added at the start
    const all = member.getAllRecordCategories({
        scopeOrganization: item?.organization, // Only include record categories of the organization where we are registering for
    });

    for (const recordCategory of all) {
        if (recordCategory.checkPermissionForUserManager(PermissionLevel.Write)) {
            steps.push(new MemberRecordCategoryStep(recordCategory, item, options));
        }
    }

    return steps;
}

/**
 * Whether an admin should complete member data before this item can be added to the cart.
 * Admins of the organization that owns the group can always register without completing the data.
 */
export function hasMissingMemberData(item: RegisterItem, context: SessionContext): boolean {
    const member = item.member;
    const family = member.family;

    if (family.checkout.isAdminFromSameOrganization) {
        return false;
    }

    // The required data can depend on the item, so it has to be pending while the steps are checked
    const pendingRegisterItems = family.pendingRegisterItems;
    family.pendingRegisterItems = [item];

    try {
        const steps = getAllMemberSteps(member, item, { outdatedTime: null });
        return new MemberStepManager(context, member, steps, () => {}).getNextStep(null) !== null;
    }
    finally {
        family.pendingRegisterItems = pendingRegisterItems;
    }
}
