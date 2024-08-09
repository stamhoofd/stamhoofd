import { PlatformMember, RegisterItem } from "@stamhoofd/structures";
import { EditMemberStep } from "../MemberStepManager";
import { MemberDataPermissionStep } from "./MemberDataPermissionStep";
import { MemberEmergencyContactsStep } from "./MemberEmergencyContactsStep";
import { MemberFinancialSupportStep } from "./MemberFinancialSupportStep";
import { MemberGeneralStep } from "./MemberGeneralStep";
import { MemberParentsStep } from "./MemberParentsStep";
import { MemberSharedStepOptions } from "./MemberSharedStepOptions";
import { MemberRecordCategoryStep } from "./MemberRecordCategoryStep";

const defaultOutdatedTime = 60*1000*60*24*31*3 // 3 months

export function getAllMemberSteps(member: PlatformMember, item: RegisterItem|null, options: MemberSharedStepOptions = {outdatedTime: defaultOutdatedTime}): EditMemberStep[] {
    const steps = [
        new MemberGeneralStep(options),
        new MemberDataPermissionStep(options),
        new MemberFinancialSupportStep(options),
        new MemberParentsStep(options),
        new MemberEmergencyContactsStep(options)
    ]

    // We'll skip these steps for now for administrators - unless it is a requirement for the platform/owning organization is different
    for (const recordCategory of member.getAllRecordCategories()) {
        steps.push(new MemberRecordCategoryStep(recordCategory, item, options));
    }

    return steps;
}
