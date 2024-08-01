import { ComponentWithProperties, NavigationController } from "@simonbackx/vue-app-navigation";
import { NavigationActions } from "../../types/NavigationActions";

export class ViewStepsManager {
    steps: ViewStep[] = []
    finishHandler: (navigate: NavigationActions) => void|Promise<void>
    present: null|'popup'|'sheet' = null

    constructor(
        steps: ViewStep[], 
        finishHandler: (navigate: NavigationActions) => void|Promise<void>,
        options?: { present?: 'popup'|'sheet' }
    ){
        this.steps = steps;
        this.finishHandler = finishHandler;
        if (options?.present) {
            this.present = options.present;
        }
    }

    async saveHandler(currentStep: ViewStep|null, navigate: NavigationActions) {
        const nextStep = this.getNextStep(currentStep);
        if (nextStep) {
            if (currentStep === null && this.present) {
                return await navigate.present({
                    modalDisplayStyle: this.present,
                    components: [
                        new ComponentWithProperties(NavigationController, {
                            root: await nextStep.getComponent(this)
                        })
                    ]
                })
            }
            return await navigate.show({
                components: [
                    await nextStep.getComponent(this)
                ]
            })
        } else {
            await this.finishHandler(navigate);
        }

    }
    
    getNextStep(step: ViewStep|null): ViewStep|null {
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

export interface ViewStep {
    getComponent(manager: MemberStepManager): Promise<ComponentWithProperties>|ComponentWithProperties
    isEnabled(manager: MemberStepManager): boolean
}
