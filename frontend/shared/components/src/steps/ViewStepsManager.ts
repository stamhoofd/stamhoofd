import { ComponentWithProperties, NavigationController } from '@simonbackx/vue-app-navigation';
import { DisplayOptions, glueNavigationActions, NavigationActions, runDisplayOptions } from '../types/NavigationActions';
import { type ViewStep } from './ViewStep';

export class ViewStepsManager {
    steps: ViewStep[] = [];
    finishHandler: (navigate: NavigationActions) => void | Promise<void>;
    displayOptions: DisplayOptions;

    constructor(
        steps: ViewStep[],
        finishHandler: (navigate: NavigationActions) => void | Promise<void>,
        displayOptions: DisplayOptions,
    ) {
        this.steps = steps;
        this.finishHandler = finishHandler;
        this.displayOptions = displayOptions;
    }

    /**
     *
     * @param currentStep
     * @param navigate
     * @param skipping Continue until the last step
     * @returns
     */
    async saveHandler(currentStep: ViewStep | null, navigate: NavigationActions, skipping = false) {
        const nextStep = skipping ? null : this.getNextStep(currentStep);
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

    start(navigate: NavigationActions) {
        return this.saveHandler(null, navigate);
    }

    getNextStep(step: ViewStep | null): ViewStep | null {
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
