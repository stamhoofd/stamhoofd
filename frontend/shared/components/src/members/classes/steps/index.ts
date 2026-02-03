import { PermissionLevel, PlatformMember, RegisterItem } from '@stamhoofd/structures';
import { EditMemberStep } from '../MemberStepManager';
import { MemberDataPermissionStep } from './MemberDataPermissionStep';
import { MemberEmergencyContactsStep } from './MemberEmergencyContactsStep';
import { MemberFinancialSupportStep } from './MemberFinancialSupportStep';
import { MemberGeneralStep } from './MemberGeneralStep';
import { MemberParentsStep } from './MemberParentsStep';
import { MemberRecordCategoryStep } from './MemberRecordCategoryStep';
import { MemberSharedStepOptions } from './MemberSharedStepOptions';
import { MemberUitpasStep } from './MemberUitpasStep';

const defaultOutdatedTime = 60 * 1000 * 60 * 24 * 31 * 3; // 3 months

export function getAllMemberSteps(member: PlatformMember, item: RegisterItem | null, options: MemberSharedStepOptions = { outdatedTime: defaultOutdatedTime }): EditMemberStep[] {
    const steps = [
        new MemberGeneralStep(options),
        new MemberDataPermissionStep(options),
        new MemberUitpasStep(options),
        new MemberFinancialSupportStep(options),
        new MemberParentsStep(options),
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
