import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { PlatformMember } from "@stamhoofd/structures";
import { NavigationActions } from "../../types/NavigationActions";

export class MemberStepManager {
    member: PlatformMember
    steps: EditMemberStep[] = []
    finishHandler: (navigate: NavigationActions) => void|Promise<void>

    constructor(member: PlatformMember, steps: EditMemberStep[], finishHandler: (navigate: NavigationActions) => void|Promise<void>){
        this.member = member
        this.steps = steps;
        this.finishHandler = finishHandler;
    }

    async saveHandler(currentStep: EditMemberStep|null, navigate: NavigationActions) {
        const nextStep = this.getNextStep(currentStep);
        if (nextStep) {
            return await navigate.show({
                components: [
                    await nextStep.getComponent(this)
                ]
            })
        } else {
            await this.finishHandler(navigate);
        }

    }
    
    getNextStep(step: EditMemberStep|null): EditMemberStep|null {
        let found = step === null;
        for (const s of this.steps) {
            if (found && s.isEnabled(this)) {
                return s;
            }
            if (s === step) {
                found = true;
            }
        }
        return null;
    }
}

export interface EditMemberStep {
    getComponent(manager: MemberStepManager): Promise<ComponentWithProperties>|ComponentWithProperties
    isEnabled(manager: MemberStepManager): boolean
}
