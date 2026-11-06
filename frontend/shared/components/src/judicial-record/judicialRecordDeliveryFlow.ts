import type { ComponentWithProperties } from '@browser/navigation';
import type { PlatformMember } from '@stamhoofd/structures';
import { AsyncComponent } from '../containers/AsyncComponent';
import type { NavigationActions } from '../types/NavigationActions';
import type { JudicialRecordDelivery, JudicialRecordStepProps } from './JudicialRecordStepProps';

/**
 * The order of the steps, and the only place that knows it. Following the pattern of
 * useMemberAdministrationOnboarding: each step gets its number and a handler to reach the next one,
 * so a step can be inserted or reordered here without touching the views.
 */
const STEPS = [
    () => import('./JudicialRecordConsentView.vue'),
    () => import('./JudicialRecordDeliveryView.vue'),
    () => import('./JudicialRecordControlView.vue'),
];

type FlowOptions = {
    member: PlatformMember;
    onBehalfOfMember: boolean;
    delivery: JudicialRecordDelivery;
    /**
     * Leaving the flow is leaving all of its steps at once, so the last step cannot simply pop: how
     * far back that is depends on how the flow was opened, which only the caller knows.
     */
    dismissHandler: (navigate: NavigationActions) => Promise<void>;
};

function buildStepProps(index: number, options: FlowOptions): JudicialRecordStepProps {
    return {
        member: options.member,
        onBehalfOfMember: options.onBehalfOfMember,
        delivery: options.delivery,
        stepNumber: index + 1,
        stepCount: STEPS.length,
        dismissHandler: options.dismissHandler,
        saveHandler: async (navigate: NavigationActions) => {
            if (index + 1 < STEPS.length) {
                await navigate.show({ components: [buildStep(index + 1, options)] });
            }
        },
    };
}

function buildStep(index: number, options: FlowOptions): ComponentWithProperties {
    return AsyncComponent(STEPS[index], buildStepProps(index, options));
}

/**
 * The first step of the flow, for a route that opens it from a url. A route needs a component and
 * the properties to mount it with, which is exactly what this hands over: which view comes first,
 * what number it carries and how it reaches the next step all stay in this file.
 *
 * The flow is a page the member navigates to and can leave with the back button, not a dialog on
 * top of the portal, so every step is pushed onto the stack the route was shown on. A screen that
 * needs it as a popup instead - the member detail in the dashboard - takes its steps off this same
 * module in whatever shape that screen turns out to need.
 */
export const judicialRecordDeliveryFlowFirstStep = {
    component: () => STEPS[0](),

    props: (options: {
        member: PlatformMember;
        /** An administrator delivering for the member confirms the member gave consent, instead of giving it. */
        onBehalfOfMember?: boolean;
        dismissHandler: (navigate: NavigationActions) => Promise<void>;
    }): JudicialRecordStepProps => buildStepProps(0, {
        member: options.member,
        onBehalfOfMember: options.onBehalfOfMember ?? false,
        delivery: { file: null, url: null, report: null, status: null },
        dismissHandler: options.dismissHandler,
    }),
};
