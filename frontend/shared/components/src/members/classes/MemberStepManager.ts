import { ComponentWithProperties, NavigationController } from '@simonbackx/vue-app-navigation';
import type { PlatformMember } from '@stamhoofd/structures';
import type { DisplayOptions, NavigationActions} from '../../types/NavigationActions';
import { defaultDisplayOptions, glueNavigationActions, runDisplayOptions } from '../../types/NavigationActions';
import type { SessionContext } from '@stamhoofd/networking/SessionContext';

export class MemberStepManager {
    member: PlatformMember;
    steps: EditMemberStep[] = [];
    finishHandler: (navigate: NavigationActions) => void | Promise<void>;
    displayOptions: DisplayOptions;
    context: SessionContext;

    constructor(
        context: SessionContext,
        member: PlatformMember,
        steps: EditMemberStep[],
        finishHandler: (navigate: NavigationActions) => void | Promise<void>,
        displayOptions?: DisplayOptions,
    ) {
        this.member = member;
        this.steps = steps;
        this.finishHandler = finishHandler;
        this.displayOptions = displayOptions || defaultDisplayOptions;
        this.context = context;
    }

    async saveHandler(currentStep: EditMemberStep | null, navigate: NavigationActions) {
        const nextStep = this.getNextStep(currentStep);
        if (nextStep) {
            if (currentStep === null) {
                return await runDisplayOptions({
                    components: [
                        new ComponentWithProperties(NavigationController, {
                            root: await nextStep.getComponent(this),
                        }),
                    ],
                }, this.displayOptions, navigate);
            }
            return await navigate.show({
                components: [
                    await nextStep.getComponent(this),
                ],
            });
        }
        else {
            // Assure that if the next step uses navigate.show, while the displayoptions are 'present', and we never presented
            // any view, we map the navigate show to something like present to match the display options
            const gluedNavigate = glueNavigationActions(currentStep !== null, navigate, this.displayOptions);
            await this.finishHandler(gluedNavigate);
        }
    }

    getNextStep(step: EditMemberStep | null): EditMemberStep | null {
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
    getName(manager: MemberStepManager): string;
    getComponent(manager: MemberStepManager): Promise<ComponentWithProperties> | ComponentWithProperties;
    isEnabled(manager: MemberStepManager): boolean;
}
