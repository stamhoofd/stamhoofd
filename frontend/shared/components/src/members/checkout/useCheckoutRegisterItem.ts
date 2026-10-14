import type { Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationController } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '#containers/AsyncComponent.ts';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import type { SessionContext } from '@stamhoofd/networking/SessionContext';
import type { Group, PlatformFamily, PlatformMember, Registration, RegistrationWithPlatformMember } from '@stamhoofd/structures';
import { GroupType, Organization, RegisterCheckout, RegisterItem } from '@stamhoofd/structures';

import { loadFamilyIfNeeded } from '#members/hooks/useLoadFamily.ts';
import { GlobalEventBus } from '@stamhoofd/networking/EventBus';
import { useContext } from '#hooks/useContext.ts';
import { Toast } from '../../overlays/Toast';
import type { DisplayOptions, NavigationActions } from '../../types/NavigationActions';
import { runDisplayOptions, useNavigationActions } from '../../types/NavigationActions';

import type { EditMemberStep } from '../classes/MemberStepManager';
import { MemberStepManager } from '../classes/MemberStepManager';
import { getAllMemberSteps } from '#members/classes/steps/getAllMemberSteps.ts';
import { RegisterItemStep } from '../classes/steps/RegisterItemStep';
import { startCheckout } from './startCheckout';
import type { ChooseGroupForMemberOptions, DefaultRegisterItemOptions, RegisterItemCheckoutOptions } from './CheckoutSelectionHandlers.ts';
import { useChooseGroupForMemberHandler, useDefaultRegisterItemHandler, useRegisterItemCheckoutHandler } from './useCheckoutSelectionHandlers.ts';

export async function loadGroupOrganization(context: SessionContext, organizationId: string, owner: any) {
    if (organizationId === context.organization?.id) {
        return context.organization;
    }

    const response = await context.getAuthenticatedServerForOrganization(organizationId).request({
        method: 'GET',
        path: '/organization',
        decoder: Organization as Decoder<Organization>,
        shouldRetry: true,
        owner,
    });

    return response.data;
}

// Flow 1: group and member are already determined
// -> no extra view in front of normal checkout flow

// Flow 2: group is determined, multiple members can be chosen from the family
// -> ChooseFamilyMembersForGroupView -> flow 1 (multiple times for each member)

// Flow 3: group is determined, multiple members need to be chosen from the whole organization or from a selection
// -> ChooseOrganizationMembersForGroupView -> flow 1 (multiple times)
// -> checkout is cleared and synced before starting this flow
// Used for bulk registrations in the dashboard

// Flow 4: member is determined, group needs to be chosen from multiple organizations
// -> ChooseGroupForMemberView -> flow 1
//
// Used for:
// - via flow 5: registering a new member or existing member from the member portal start page
// - registering an indiviual member from the dashboard

// Flow 5: members nor group is determined
// -> registration.RegisterMembersView (choose a member from your family) followed by flow 4
//
// Used for:
// - registering a new member or existing member from the member portal start page

// Flow 6: Add a new member
// -> MemberStepView(EditMemberGeneralBox) -> followed by flow 4

// ----------------------------
// --------- Flow 1 -----------

export async function checkoutRegisterItem({ item: originalItem, admin, context, displayOptions, navigate, startCheckoutFlow, finishHandler }: RegisterItemCheckoutOptions) {
    let item = originalItem;

    if (item.group.waitingList && item.validationError && !item.validationErrorForWaitingList) {
        // Should register for the waiting list
        item = RegisterItem.defaultFor(item.member, item.group.waitingList, item.organization);
        item.cartError = originalItem.cartError;
    }

    if (item.groupPrice.bundleDiscounts.size > 0) {
        // Load the full family first if there are bundle discounts
        await loadFamilyIfNeeded({ member: item.member, context, owner: {} }, { shouldRetry: false });
    }

    const member = item.member;

    // Add it to the platform member
    member.family.pendingRegisterItems = [item];
    member.family.checkout.defaultOrganization = item.organization;

    if (admin) {
        if (!context.organization) {
            // Administration panel: register as organizing organization
            member.family.checkout.asOrganizationId = item.organization.id;
        }
        else {
            member.family.checkout.asOrganizationId = context.organization.id;
        }
    }

    // Check which steps need a review or are not complete
    const steps: EditMemberStep[] = [
        new RegisterItemStep(item, { willStartCheckoutFlow: startCheckoutFlow ?? false }),
    ];

    if (!member.family.checkout.isAdminFromSameOrganization) {
        // For admins: skip filled steps, because we won't mark anything reviewed here
        // (we only do when members are filling things in)
        // Otherwise admins will have to review all the steps every time.
        steps.push(...getAllMemberSteps(member, item, admin ? { outdatedTime: null } : undefined));
    }
    else {
        if (item.replaceRegistrations.length > 0) {
            // By default never send emails for moves or edits
            member.family.checkout.sendConfirmationEmail = false;
        }
        else {
            member.family.checkout.sendConfirmationEmail = item.group.privateSettings?.sendConfirmationEmailForManualRegistrations ?? false;
        }
    }

    const manager = new MemberStepManager(context, member, steps, async (navigate) => {
        // Clear errors
        item.cartError = null;

        // Move the item to the cart (replace if it already exists)
        if (item !== originalItem) {
            member.family.checkout.remove(originalItem);
        }
        member.family.checkout.add(item); // With price calculation
        member.family.pendingRegisterItems = [];

        if (!member.family.checkout.cart.contains(item)) {
            Toast.error($t(`%ec`)).show();
            return;
        }

        if (startCheckoutFlow) {
            // Automatically checkout the cart here
            // If needed, we'll need to start the normal checkout flow where we'll invoice between organizations (in case of registering members for other organizations)
            try {
                return await startCheckout({
                    checkout: member.family.checkout,
                    context,
                    displayOptions: { action: 'show' },
                }, navigate);
            }
            catch (e) {
                Toast.fromError(e).show();
                return;
            }
        }
        else {
            if (!admin) {
                if (item.group.type === GroupType.WaitingList) {
                    Toast.warning($t(`%ed`)).setIcon('clock').show();
                }
                else {
                    Toast.success($t(`%ee`)).setIcon('basket').show();
                }
                await GlobalEventBus.sendEvent('selectTabById', 'cart');
            }
        }

        await navigate.dismiss({ force: true });
        if (finishHandler) {
            await finishHandler();
        }
    }, displayOptions);

    await manager.saveHandler(null, navigate);
}

export async function getDefaultItem({ group, member, groupOrganization, context, owner }: DefaultRegisterItemOptions) {
    if (!groupOrganization) {
        try {
            groupOrganization = await loadGroupOrganization(context, group.organizationId, owner);
        }
        catch (e) {
            Toast.fromError(e).show();
            return;
        }
    }

    return RegisterItem.defaultFor(member, group, groupOrganization);
}

export async function checkoutDefaultItem({ group, member, admin, groupOrganization, context, displayOptions, navigate, startCheckoutFlow, owner, finishHandler }: {
    group: Group;
    member: PlatformMember;
    groupOrganization?: Organization;
    context: SessionContext;
    navigate: NavigationActions;
    admin?: boolean;
    displayOptions?: DisplayOptions;
    startCheckoutFlow?: boolean;
    owner?: any;
    finishHandler?: () => Promise<void> | void;
}) {
    const item = await getDefaultItem({ group, member, groupOrganization, context, owner });
    if (!item) {
        return;
    }
    return await checkoutRegisterItem({
        context,
        item,
        displayOptions,
        admin,
        navigate,
        startCheckoutFlow,
        finishHandler,
    });
}

export function useCheckoutRegisterItem() {
    return useRegisterItemCheckoutHandler(checkoutRegisterItem);
}

export function useGetDefaultItem() {
    return useDefaultRegisterItemHandler(getDefaultItem);
}

// ----------------------------
// --------- Flow 2 -----------

export async function chooseFamilyMembersForGroup({ navigate, group, family, displayOptions }: {
    group: Group;
    family: PlatformFamily;
    navigate: NavigationActions;
    displayOptions: DisplayOptions;
}) {
    await runDisplayOptions({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: AsyncComponent(() => import('../ChooseFamilyMembersForGroupView.vue'), {
                    family,
                    group,
                    checkoutRegisterItemHandler: checkoutRegisterItem,
                }),
            }),
        ],
    }, displayOptions, navigate);
}

export function useChooseFamilyMembersForGroup() {
    const navigate = useNavigationActions();

    return async ({ group, family, displayOptions }: { group: Group; family: PlatformFamily; displayOptions: DisplayOptions }) => {
        return await chooseFamilyMembersForGroup({ group, family, navigate, displayOptions });
    };
}

// ----------------------------
// --------- Flow 3 -----------
export async function openOrganizationCart({ organization, checkout, context, navigate, group, members }: {
    organization: Organization;
    checkout?: RegisterCheckout;
    context: SessionContext;
    navigate: NavigationActions;
    group?: Group; // Optional: add a button to search for members to register in this group
    members?: PlatformMember[]; // Automatically add default items for these members to the checkout if group is also provided
}) {
    const { default: ChooseOrganizationMembersForGroupView } = await import('../ChooseOrganizationMembersForGroupView.vue');
    const groupOrganization = organization;

    // Create a new shared checkout for these members
    if (!checkout) {
        checkout = new RegisterCheckout();
    }
    checkout.defaultOrganization = groupOrganization;

    if (!context.organization) {
        // Administration panel: register as organizing organization
        checkout.asOrganizationId = groupOrganization.id;
    }
    else {
        checkout.asOrganizationId = context.organization.id;
    }

    if (checkout.isAdminFromSameOrganization && group) {
        checkout.sendConfirmationEmail = group.privateSettings?.sendConfirmationEmailForManualRegistrations ?? false;
    }

    checkout.updatePrices();

    await navigate.present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(ChooseOrganizationMembersForGroupView, {
                    groupOrganization,
                    checkout,
                    group,
                    members,
                    checkoutRegisterItemHandler: checkoutRegisterItem,
                    getDefaultItemHandler: getDefaultItem,
                    chooseGroupForMemberHandler: chooseGroupForMember,
                }),
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

export function useOrganizationCart() {
    const navigate = useNavigationActions();
    const context = useContext();

    return async ({ members, group, organization, checkout }: { members?: PlatformMember[]; group?: Group; organization: Organization; checkout: RegisterCheckout }) => {
        return await openOrganizationCart({ members, group, organization, checkout, navigate, context: context.value });
    };
}

export async function chooseOrganizationMembersForGroup({ members, group, organization, items, context, navigate, owner, deleteRegistrations }: {
    members?: PlatformMember[]; // Automatically add default items for these members to the checkout if group is also provided
    group?: Group;
    organization?: Organization;
    context: SessionContext;
    items?: RegisterItem[];
    deleteRegistrations?: RegistrationWithPlatformMember<Registration, PlatformMember>[];
    navigate: NavigationActions;
    owner: any;
}) {
    if (!organization && !group) {
        throw new Error('Either organization or group should be provided');
    }

    const groupOrganization = organization ?? await loadGroupOrganization(context, group!.organizationId, owner);

    // Create a new shared checkout for these members
    const checkout = new RegisterCheckout();

    if (members) {
        for (const member of members) {
            member.family.checkout = checkout;
            member.family.pendingRegisterItems = [];

            if (items === undefined && group) {
                const item = RegisterItem.defaultFor(member, group, groupOrganization);
                checkout.add(item, { calculate: false });
            }
        }
    }

    if (items !== undefined) {
        for (const item of items) {
            item.member.family.checkout = checkout;
            item.member.family.pendingRegisterItems = [];
            checkout.add(item, { calculate: false });
        }
    }

    if (deleteRegistrations) {
        for (const registration of deleteRegistrations) {
            checkout.removeRegistration(registration, { calculate: false });
        }
    }

    await openOrganizationCart({
        organization: groupOrganization,
        members,
        group,
        checkout,
        navigate,
        context,
    });
}

export function useChooseOrganizationMembersForGroup() {
    const navigate = useNavigationActions();
    const context = useContext();
    const owner = useRequestOwner();

    return async ({ members, group, items }: { members: PlatformMember[]; group: Group; items?: RegisterItem[] }) => {
        return await chooseOrganizationMembersForGroup({ members, group, items, navigate, context: context.value, owner });
    };
}

// ----------------------------
// --------- Flow 4 -----------

export async function chooseGroupForMember({ member, navigate, context, displayOptions, startCheckoutFlow, admin, defaultOrganization }: ChooseGroupForMemberOptions) {
    await runDisplayOptions({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: AsyncComponent(() => import('#members/ChooseGroupForMemberView.vue'), {
                    member,
                    defaultOrganization,
                    selectionHandler: async ({ group, groupOrganization }: { group: Group; groupOrganization?: Organization }, navigate: NavigationActions) => {
                        await checkoutDefaultItem({
                            member,
                            group,
                            groupOrganization,
                            admin: admin ?? false,
                            navigate,
                            context,
                            displayOptions: { action: 'show' },
                            startCheckoutFlow,
                        });
                    },
                }),
            }),
        ],
    }, displayOptions ?? { action: 'show' }, navigate);
}

export function useChooseGroupForMember() {
    return useChooseGroupForMemberHandler(chooseGroupForMember);
}
