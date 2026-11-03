import { ComponentWithProperties, NavigationController } from '@browser/navigation';
import type { PlatformMember } from '@stamhoofd/structures';
import { AsyncComponent } from '../containers/AsyncComponent';
import type { DisplayOptions, NavigationActions } from '../types/NavigationActions';
import type { JudicialRecordDelivery, JudicialRecordStepProps } from './JudicialRecordStepProps';

/**
 * The order of the steps, and the only place that knows it. Following the pattern of
 * useMemberAdministrationOnboarding: each step gets its number and a handler to reach the next one,
 * so a step can be inserted or reordered here without touching the views.
 */
const STEPS = [
    () => import('./JudicialRecordConsentView.vue'),
    () => import('./JudicialRecordDeliveryView.vue'),
    () => import('./JudicialRecordResultView.vue'),
];

type FlowOptions = {
    member: PlatformMember;
    onBehalfOfMember: boolean;
    delivery: JudicialRecordDelivery;
    /** Set by presentJudicialRecordDeliveryFlow once it knows how the flow was opened. */
    dismissHandler: (navigate: NavigationActions) => Promise<void>;
};

function buildStep(index: number, options: FlowOptions): ComponentWithProperties {
    return AsyncComponent(STEPS[index], {
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
    } satisfies JudicialRecordStepProps);
}

/**
 * Opens the flow that lets a member deliver their extract from the judicial record. The same flow is
 * used by an administrator delivering for a member, which is what onBehalfOfMember changes the wording for.
 *
 * The steps are pushed onto the current stack by default: from the member portal this is a page the
 * member navigates to and can leave with the back button, not a dialog on top of the portal. Callers
 * that open it from a popup (the member detail in the dashboard) pass `present` instead.
 */
export async function presentJudicialRecordDeliveryFlow(options: {
    member: PlatformMember;
    navigate: NavigationActions;
    onBehalfOfMember?: boolean;
    displayOptions?: DisplayOptions;
}) {
    const displayOptions = options.displayOptions ?? { action: 'show' };

    const root = buildStep(0, {
        member: options.member,
        onBehalfOfMember: options.onBehalfOfMember ?? false,
        delivery: { file: null },

        // Leaving a flow is leaving all of its steps at once, so the last step cannot simply pop:
        // how far back that is depends on how the flow was opened, which only this function knows.
        dismissHandler: async (navigate: NavigationActions) => {
            if (displayOptions.action === 'present') {
                await navigate.dismiss({ force: true });
                return;
            }

            if (navigate.navigationController) {
                await navigate.navigationController.popToRoot({ force: true });
                return;
            }

            await navigate.pop({ force: true });
        },
    });

    if (displayOptions.action === 'show') {
        await options.navigate.show({ ...displayOptions, components: [root] });
        return;
    }

    // A presented flow needs its own stack, otherwise the second step has nowhere to be pushed onto
    await options.navigate.present({
        ...displayOptions,
        components: [new ComponentWithProperties(NavigationController, { root })],
    });
}
