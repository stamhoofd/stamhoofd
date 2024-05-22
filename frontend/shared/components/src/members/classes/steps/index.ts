import { EditMemberStep } from "../MemberStepManager";
import { MemberGeneralStep } from "./MemberGeneralStep";
import { MemberParentsStep } from "./MemberParentsStep";

export const allMemberSteps: EditMemberStep[] = [
    MemberGeneralStep,
    MemberParentsStep
]
