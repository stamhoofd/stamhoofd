import { ComponentWithProperties, NavigationController } from '@simonbackx/vue-app-navigation';
import { useRequiredOrganization } from '@stamhoofd/components/hooks/useOrganization';
import { Toast } from '@stamhoofd/components/overlays/Toast';
import type { DisplayOptions, NavigationActions } from '@stamhoofd/components/types/NavigationActions';
import { runDisplayOptions, useNavigationActions } from '@stamhoofd/components/types/NavigationActions';
import type { Component } from 'vue';
import { MemberAdministrationOnboardingViewModel } from './MemberAdministrationOnboardingViewModel';
import OnboardingGroupPricesView from './OnboardingGroupPricesView.vue';
import OnboardingGroupsView from './OnboardingGroupsView.vue';
import OnboardingMemberAdministrationView from './OnboardingMemberAdministrationView.vue';
import OnboardingRegistrationPeriodView from './OnboardingRegistrationPeriodView.vue';
import BoxedController from '@stamhoofd/components/containers/BoxedController.vue';
import type { Organization } from '@stamhoofd/structures';
import { OrganizationCheckout, OrganizationType, OrganizationTypeHelper, PackagePurchases, PaymentCustomer, PaymentMethod, STPackageBundle } from '@stamhoofd/structures';
import { useActivatePackages } from '../dashboard/settings/packages/hooks/useActivatePackages';
import { GlobalEventBus } from '@stamhoofd/components/EventBus';
import { useUser } from '@stamhoofd/components/hooks/useUser';

/**
 * The ordered list of steps the user walks through to onboard their member administration.
 * Each step receives the shared view model and a `saveHandler` that advances to the next step.
 */
const steps: Component[] = [
    OnboardingMemberAdministrationView, // Step 1: organization type + umbrella organization
    OnboardingRegistrationPeriodView, // Step 2: current work year
    OnboardingGroupsView, // Step 3: subdivisions / age groups
    OnboardingGroupPricesView, // Step 4: prices and advanced settings
];

/**
 * The props every onboarding step view receives.
 */
export type OnboardingStepProps = {
    viewModel: MemberAdministrationOnboardingViewModel;
    saveHandler: (navigate: NavigationActions) => Promise<void>;
    stepNumber: number;
    stepCount: number;
};

/**
 * The first step (organization type details) only collects extra information for sport
 * organizations (a concrete sport) and youth organizations (an umbrella organization).
 * For everyone else there is nothing left to ask, so the step is skipped.
 */
function needsTypeDetailsStep(organization: Organization): boolean {
    const category = OrganizationTypeHelper.getCategory(organization.meta.type);
    return category === OrganizationTypeHelper.getCategory(OrganizationType.Sport)
        || category === OrganizationTypeHelper.getCategory(OrganizationType.Youth);
}

/**
 * Starts the member administration onboarding flow. Following the pattern of
 * useStartOrganizationCheckout, the flow is driven by a view model that carries the
 * collected information from one step to the next.
 *
 * The view that lets the user choose what to start with (OnboardingStartView) is kept
 * outside of this flow and simply calls the returned function.
 */
export function useMemberAdministrationOnboarding() {
    const organization = useRequiredOrganization();
    const navigationActions = useNavigationActions();

    function buildStep(index: number, model: MemberAdministrationOnboardingViewModel, stepList: Component[], displayOptions: DisplayOptions, finishHandler: () => Promise<void> | void): ComponentWithProperties {
        return new ComponentWithProperties(BoxedController, {
            root: new ComponentWithProperties(stepList[index], {
                viewModel: model,
                stepNumber: index + 1,
                stepCount: stepList.length,
                saveHandler: async (navigate: NavigationActions) => {
                    if (index + 1 < stepList.length) {
                        await navigate.show({
                            components: [buildStep(index + 1, model, stepList, displayOptions, finishHandler)],
                        });
                        return;
                    }

                    // Last step: leave the flow (changes were already persisted per step).
                    await finish(navigate, model, displayOptions, finishHandler);
                },
            } satisfies OnboardingStepProps),
        });
    }

    const activatePackages = useActivatePackages();
    const user = useUser();

    async function finish(navigate: NavigationActions, _model: MemberAdministrationOnboardingViewModel, displayOptions: DisplayOptions, finishHandler: () => Promise<void> | void) {
        try {
            await activatePackages(
                OrganizationCheckout.create({
                    purchases: PackagePurchases.create({
                        packageBundles: [STPackageBundle.TrialMembers],
                    }),
                    paymentMethod: PaymentMethod.Unknown,
                    customer: PaymentCustomer.create({
                        firstName: user.value?.firstName,
                        lastName: user.value?.lastName,
                        email: user.value?.email,
                        company: organization.value.defaultCompanies[0],
                    }),
                }),
            );
        } catch (e) {
            console.error(e);
            Toast.fromError(e).show();
            return;
        }
        // Each step already persisted its own changes, so here we only have to leave the flow
        // and return to the onboarding start view (the root of this navigation controller).
        // TODO: decide where to send the user next (e.g. activate their first package).
        try {
            if (displayOptions.action !== 'present') {
                if (navigate.navigationController) {
                    await navigate.navigationController.popToRoot({ force: true });
                } else {
                    await navigate.pop({ force: true });
                }
            } else {
                await navigate.dismiss({ force: true });
            }

            await finishHandler();
        } catch (e) {
            console.error('Failed to dismiss', e);
        }

        await GlobalEventBus.sendEvent('selectTabById', 'members');
        Toast.success($t('Jullie ledenadministratie is klaar voor gebruik. Je kan nu meer instellingen aanvullen, leden importeren of het ledenportaal uitproberen.')).show();
    }

    return async function startMemberAdministrationOnboarding({ displayOptions, finishHandler }: {
        displayOptions: DisplayOptions;
        finishHandler?: () => Promise<void> | void;
    }) {
        const model = new MemberAdministrationOnboardingViewModel({
            organization: organization.value,
        });

        // Skip the organization type details step when there is nothing extra to collect.
        const effectiveSteps = needsTypeDetailsStep(organization.value) ? steps : steps.slice(1);

        await runDisplayOptions({
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: buildStep(0, model, effectiveSteps, displayOptions, finishHandler ?? (() => {})),
                }),
            ],
        }, displayOptions, navigationActions);
    };
}
