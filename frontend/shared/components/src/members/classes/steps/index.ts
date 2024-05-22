import { EditMemberStep } from "../MemberStepManager";
import { MemberDataPermissionStep } from "./MemberDataPermissionStep";
import { MemberEmergencyContactsStep } from "./MemberEmergencyContactsStep";
import { MemberGeneralStep } from "./MemberGeneralStep";
import { MemberParentsStep } from "./MemberParentsStep";

export const allMemberSteps: EditMemberStep[] = [
    MemberGeneralStep,
    MemberDataPermissionStep,
    MemberParentsStep,
    MemberEmergencyContactsStep
]
