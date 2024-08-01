import { ComponentWithProperties, NavigationController } from "@simonbackx/vue-app-navigation";
import { Group, Organization, PlatformFamily, PlatformMember, RegisterCheckout, RegisterItem } from "@stamhoofd/structures";
import { Toast } from "../../overlays/Toast";
import { NavigationActions, useNavigationActions } from "../../types/NavigationActions";
import { EditMemberStep, MemberStepManager } from "../classes/MemberStepManager";
import { allMemberSteps } from "../classes/steps";
import { MemberRecordCategoryStep } from "../classes/steps/MemberRecordCategoryStep";
import { RegisterItemStep } from "../classes/steps/RegisterItemStep";
import { ChooseGroupForMemberView } from "..";
import { startCheckout } from "./startCheckout";
import { SessionContext } from "@stamhoofd/networking";
import { useContext } from "../../hooks";

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

export async function checkoutRegisterItem({item, admin, context, options, navigate, showGroupInformation, startCheckoutFlow}: {
    item: RegisterItem,
    navigate: NavigationActions,
    context: SessionContext,
    admin?: boolean,
    showGroupInformation?: boolean,
    options?: { present?: 'popup'|'sheet' },
    startCheckoutFlow?: boolean
}) {
    const member = item.member;

    // Add it to the platform member
    member.family.pendingRegisterItems = [item];

    if (admin) {
        if (!context.organization) {
            Toast.error('Het is niet mogelijk om iemand in te schrijven als beheerder zonder eerst naar het beheerdersportaal te gaan van een organisatie.').show()
            return;
        }
        member.family.checkout.asOrganizationId = context.organization.id
    }

    // Check which steps need a review or are not complete
    const steps: EditMemberStep[] = [
        new RegisterItemStep(item, {admin, showGroupInformation}),
    ]

    if (!admin) {
        steps.push(...allMemberSteps)
        
        // We'll skip these steps for now for administrators - unless it is a requirement for the platform/owning organization is different
        for (const recordCategory of member.getAllRecordCategories()) {
            steps.push(new MemberRecordCategoryStep(recordCategory, item));
        }
    }

    const manager = new MemberStepManager(member, steps, async (navigate) => {
        // Move the item to the cart
        member.family.checkout.cart.add(item);
        member.family.pendingRegisterItems = [];
        member.family.checkout.updatePrices()

        if (startCheckoutFlow) {
            // Automatically checkout the cart here
            // If needed, we'll need to start the normal checkout flow where we'll invoice between organizations (in case of registering members for other organizations)
            try {
                return await startCheckout({
                    checkout: member.family.checkout,
                    context
                }, navigate);
            } catch (e) {
                Toast.fromError(e).show()
                return;
            }
        } else {
            Toast.success('Inschrijving toegevoegd aan winkelmandje. Ga naar het winkelmandje als je alle inschrijvingen hebt toegevoegd om af te rekenen.').show();
        }
        await navigate.dismiss({force: true})

    }, options);

    await manager.saveHandler(null, navigate);
}

export async function checkoutDefaultItem({group, member, admin, organization, context, options, navigate, showGroupInformation, startCheckoutFlow}: {
    group: Group,
    member: PlatformMember,
    organization: Organization,
    context: SessionContext,
    navigate: NavigationActions
    admin?: boolean,
    showGroupInformation?: boolean,
    options?: { present?: 'popup'|'sheet' },
    startCheckoutFlow?: boolean
}) {
    return await checkoutRegisterItem({
        context,
        item: RegisterItem.defaultFor(member, group, organization), 
        options, 
        admin, 
        navigate,
        showGroupInformation,
        startCheckoutFlow
    });
}

export function useCheckoutRegisterItem() {
    const navigate = useNavigationActions();
    const context = useContext()

    return async (item: RegisterItem, admin = false, options?: { present?: 'popup'|'sheet' }) => {
        await checkoutRegisterItem({item, admin, options, navigate, context: context.value});
    }
}

export function useCheckoutDefaultItem() {
    const navigate = useNavigationActions();
    const context = useContext()

    return async ({group, member, organization, admin = false, options}: {group: Group, member: PlatformMember, organization: Organization, admin?: boolean, options?: { present?: 'popup'|'sheet' }}) => {
        await checkoutDefaultItem({
            group, 
            member, 
            organization, 
            admin, 
            options, 
            navigate, 
            context: context.value
        });
    }
}

// ----------------------------
// --------- Flow 2 -----------

export function useChooseFamilyMembersForGroup() {
    const navigate = useNavigationActions();
    const context = useContext()

    return async ({group, organization, family}: {group: Group, organization: Organization, family: PlatformFamily}) => {
        await navigate.present({
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties('ChooseFamilyMembersForGroupView', {
                        family,
                        group,
                        organization,
                        async selectionHandler(member: PlatformMember, navigate: NavigationActions) {
                            await checkoutDefaultItem({member, group, organization, admin: false, navigate, context: context.value});
                        }
                    })
                })
            ]
        })
    }
}



// ----------------------------
// --------- Flow 3 -----------

export async function chooseOrganizationMembersForGroup({members, group, organization, items, navigate, context}: {
    members: PlatformMember[], 
    group: Group, 
    organization: Organization, 
    context: SessionContext,
    items?: RegisterItem[], 
    navigate: NavigationActions
}) {
    // Create a new shared checkout for these members
    const checkout = new RegisterCheckout();
    for (const member of members) {
        member.family.checkout = checkout;
        member.family.pendingRegisterItems = [];
    }

    if (items) {
        for (const item of items) {
            checkout.cart.add(item);
        }
    }

    await navigate.present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties('ChooseOrganizationMembersForGroupView', {
                    members,
                    group,
                    organization,
                    checkout,
                    async selectionHandler(member: PlatformMember, navigate: NavigationActions) {
                        await checkoutDefaultItem({
                            member, 
                            group, 
                            organization, 
                            context,
                            admin: true,
                            navigate,
                            startCheckoutFlow: false
                        });
                    }
                })
            })
        ],
        modalDisplayStyle: 'popup'
    })

}

export function useChooseOrganizationMembersForGroup() {
    const navigate = useNavigationActions();
    const context = useContext();

    return async ({members, group, organization, items}: {members: PlatformMember[], group: Group, organization: Organization, items?: RegisterItem[]}) => {
        return await chooseOrganizationMembersForGroup({members, group, organization, items, navigate, context: context.value});
    }
}

// ----------------------------
// --------- Flow 4 -----------

export async function chooseGroupForMember({member, navigate, context}: {member: PlatformMember, navigate: NavigationActions, context: SessionContext}) {
    await navigate.present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(ChooseGroupForMemberView, {
                    member,
                    selectionHandler: async ({group, organization}: {group: Group, organization: Organization}, navigate: NavigationActions) => {
                        await checkoutDefaultItem({member, group, organization, admin: false, navigate, context});
                    }
                })
            })
        ]
    })
}

export function useChooseGroupForMember() {
    const navigate = useNavigationActions();
    const context = useContext();

    return async ({member}: {member: PlatformMember}) => {
        await chooseGroupForMember({member, navigate, context: context.value});
    }
}
