import { Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationController } from '@simonbackx/vue-app-navigation';
import { SessionContext, useRequestOwner } from '@stamhoofd/networking';
import { Group, GroupType, Organization, PlatformFamily, PlatformMember, RegisterCheckout, RegisterItem, RegistrationWithPlatformMember } from '@stamhoofd/structures';
import { ChooseGroupForMemberView, loadFamilyIfNeeded } from '..';
import { useAppContext } from '../../context/appContext';
import { GlobalEventBus } from '../../EventBus';
import { useContext } from '../../hooks';
import { Toast } from '../../overlays/Toast';
import { DisplayOptions, NavigationActions, runDisplayOptions, useNavigationActions } from '../../types/NavigationActions';
import ChooseFamilyMembersForGroupView from '../ChooseFamilyMembersForGroupView.vue';
import ChooseOrganizationMembersForGroupView from '../ChooseOrganizationMembersForGroupView.vue';
import { EditMemberStep, MemberStepManager } from '../classes/MemberStepManager';
import { getAllMemberSteps } from '../classes/steps';
import { RegisterItemStep } from '../classes/steps/RegisterItemStep';
import { startCheckout } from './startCheckout';

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

export async function checkoutRegisterItem({ item: originalItem, admin, context, displayOptions, navigate, startCheckoutFlow, finishHandler }: {
    item: RegisterItem;
    navigate: NavigationActions;
    context: SessionContext;
    admin?: boolean;
    displayOptions?: DisplayOptions;
    startCheckoutFlow?: boolean;
    finishHandler?: () => Promise<void> | void;
}) {
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
            Toast.error($t(`444bd147-6a22-4fd5-b1e7-94eab9de9eb3`)).show();
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
                    Toast.warning($t(`ead74946-05e3-4a81-ba41-5f6cddbc8292`)).setIcon('clock').show();
                }
                else {
                    Toast.success($t(`fa2ecc9e-94d0-49fb-9968-2227528ef22f`)).setIcon('basket').show();
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

export async function getDefaultItem({ group, member, groupOrganization, context, owner }: {
    group: Group;
    member: PlatformMember;
    groupOrganization?: Organization;
    context: SessionContext;
    owner?: any;
}) {
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
    const navigate = useNavigationActions();
    const context = useContext();
    const app = useAppContext();

    return async ({
        item,
        startCheckoutFlow,
        displayOptions,
        customNavigate,
        finishHandler,
    }: {
        item: RegisterItem;
        startCheckoutFlow?: boolean;
        displayOptions?: DisplayOptions;
        customNavigate?: NavigationActions;
        finishHandler?: () => Promise<void> | void;

    }) => {
        await checkoutRegisterItem({
            item,
            admin: app === 'dashboard' || app === 'admin',
            displayOptions,
            startCheckoutFlow,
            context: context.value,
            navigate: customNavigate ?? navigate,
            finishHandler,
        });
    };
}

export function useGetDefaultItem() {
    const context = useContext();
    const owner = useRequestOwner();

    return async ({ group, member, groupOrganization }: {
        group: Group;
        member: PlatformMember;
        groupOrganization?: Organization;
    }) => {
        return await getDefaultItem({
            group,
            member,
            groupOrganization,
            context: context.value,
            owner,
        });
    };
}

export function useCheckoutDefaultItem() {
    const navigate = useNavigationActions();
    const context = useContext();
    const app = useAppContext();
    const owner = useRequestOwner();

    return async ({ group, member, groupOrganization, displayOptions, startCheckoutFlow, customNavigate, finishHandler }: {
        group: Group;
        member: PlatformMember;
        groupOrganization?: Organization;
        startCheckoutFlow?: boolean;
        displayOptions?: DisplayOptions;
        customNavigate?: NavigationActions;
        finishHandler?: () => Promise<void> | void;
    }) => {
        await checkoutDefaultItem({
            group,
            member,
            groupOrganization,
            admin: app === 'dashboard' || app === 'admin',
            displayOptions,
            navigate: customNavigate ?? navigate,
            context: context.value,
            startCheckoutFlow,
            owner,
            finishHandler,
        });
    };
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
                root: new ComponentWithProperties(ChooseFamilyMembersForGroupView, {
                    family,
                    group,
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
    deleteRegistrations?: RegistrationWithPlatformMember[];
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

export async function chooseGroupForMember({ member, navigate, context, displayOptions, startCheckoutFlow, admin }: { admin?: boolean; member: PlatformMember; navigate: NavigationActions; context: SessionContext; displayOptions?: DisplayOptions; startCheckoutFlow?: boolean }) {
    await runDisplayOptions({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(ChooseGroupForMemberView, {
                    member,
                    selectionHandler: async ({ group, groupOrganization }: { group: Group; groupOrganization: Organization }, navigate: NavigationActions) => {
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
    const navigate = useNavigationActions();
    const context = useContext();
    const app = useAppContext();

    return async ({ member, displayOptions, customNavigate, startCheckoutFlow }: { member: PlatformMember; displayOptions?: DisplayOptions; customNavigate?: NavigationActions; startCheckoutFlow?: boolean }) => {
        if (app !== 'registration') {
            member.family.checkout.clear();
        }

        await chooseGroupForMember({
            admin: app === 'dashboard' || app === 'admin',
            member,
            navigate: customNavigate ?? navigate,
            context: context.value,
            displayOptions,
            startCheckoutFlow: startCheckoutFlow ?? (app !== 'registration'),
        });
    };
}
