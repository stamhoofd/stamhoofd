import { EditMemberStep } from "../MemberStepManager";
import { MemberDataPermissionStep } from "./MemberDataPermissionStep";
import { MemberEmergencyContactsStep } from "./MemberEmergencyContactsStep";
import { MemberFinancialSupportStep } from "./MemberFinancialSupportStep";
import { MemberGeneralStep } from "./MemberGeneralStep";
import { MemberParentsStep } from "./MemberParentsStep";

export const allMemberSteps: EditMemberStep[] = [
    MemberGeneralStep,
    MemberFinancialSupportStep,
    MemberDataPermissionStep,
    MemberParentsStep,
    MemberEmergencyContactsStep
]
