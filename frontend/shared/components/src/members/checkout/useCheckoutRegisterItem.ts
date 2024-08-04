import { Decoder } from "@simonbackx/simple-encoding";
import { ComponentWithProperties, NavigationController } from "@simonbackx/vue-app-navigation";
import { SessionContext, useRequestOwner } from "@stamhoofd/networking";
import { Group, Organization, PlatformFamily, PlatformMember, RegisterCheckout, RegisterItem, RegistrationWithMember } from "@stamhoofd/structures";
import { ChooseGroupForMemberView } from "..";
import { useAppContext } from "../../context/appContext";
import { useContext } from "../../hooks";
import { Toast } from "../../overlays/Toast";
import { DisplayOptions, NavigationActions, useNavigationActions } from "../../types/NavigationActions";
import ChooseOrganizationMembersForGroupView from "../ChooseOrganizationMembersForGroupView.vue";
import { EditMemberStep, MemberStepManager } from "../classes/MemberStepManager";
import { allMemberSteps } from "../classes/steps";
import { MemberRecordCategoryStep } from "../classes/steps/MemberRecordCategoryStep";
import { RegisterItemStep } from "../classes/steps/RegisterItemStep";
import { startCheckout } from "./startCheckout";

export async function loadGroupOrganization(context: SessionContext, organizationId: string, owner: any) {
    if (organizationId === context.organization?.id) {
        return context.organization;
    }

    const response = await SessionContext.serverForOrganization(organizationId).request({
        method: "GET",
        path: "/organization",
        decoder: Organization as Decoder<Organization>,
        shouldRetry: true,
        owner
    })

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

export async function checkoutRegisterItem({item, admin, context, displayOptions, navigate, showGroupInformation, startCheckoutFlow}: {
    item: RegisterItem,
    navigate: NavigationActions,
    context: SessionContext,
    admin?: boolean,
    showGroupInformation?: boolean,
    displayOptions?: DisplayOptions,
    startCheckoutFlow?: boolean
}) {
    const member = item.member;

    // Add it to the platform member
    member.family.pendingRegisterItems = [item];
    member.family.checkout.defaultOrganization = item.organization

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
        member.family.checkout.remove(item, {calculate: false}); // Fast delete without price calculation
        member.family.checkout.add(item); // With price calculation
        member.family.pendingRegisterItems = [];

        if (startCheckoutFlow) {
            // Automatically checkout the cart here
            // If needed, we'll need to start the normal checkout flow where we'll invoice between organizations (in case of registering members for other organizations)
            try {
                return await startCheckout({
                    checkout: member.family.checkout,
                    context,
                    displayOptions: {action: 'show'}
                }, navigate);
            } catch (e) {
                Toast.fromError(e).show()
                return;
            }
        } else {
            Toast.success('Inschrijving toegevoegd aan winkelmandje. Ga naar het winkelmandje als je alle inschrijvingen hebt toegevoegd om af te rekenen.').show();
        }

        await navigate.dismiss({force: true})
    }, displayOptions);

    await manager.saveHandler(null, navigate);
}

export async function checkoutDefaultItem({group, member, admin, groupOrganization, context, displayOptions, navigate, showGroupInformation, startCheckoutFlow}: {
    group: Group,
    member: PlatformMember,
    groupOrganization: Organization,
    context: SessionContext,
    navigate: NavigationActions
    admin?: boolean,
    showGroupInformation?: boolean,
    displayOptions?: DisplayOptions,
    startCheckoutFlow?: boolean
}) {
    return await checkoutRegisterItem({
        context,
        item: RegisterItem.defaultFor(member, group, groupOrganization), 
        displayOptions, 
        admin, 
        navigate,
        showGroupInformation,
        startCheckoutFlow
    });
}

export function useCheckoutRegisterItem() {
    const navigate = useNavigationActions();
    const context = useContext()
    const app = useAppContext()

    return async ({item, startCheckoutFlow, displayOptions}: {item: RegisterItem, startCheckoutFlow?: boolean, displayOptions?: DisplayOptions}) => {
        await checkoutRegisterItem({
            item, 
            admin: app === 'dashboard' || app === 'admin', 
            displayOptions, 
            navigate, 
            startCheckoutFlow, 
            context: context.value
        });
    }
}

export function useCheckoutDefaultItem() {
    const navigate = useNavigationActions();
    const context = useContext()
    const app = useAppContext()

    return async ({group, member, groupOrganization, displayOptions, startCheckoutFlow}: {group: Group, member: PlatformMember, groupOrganization: Organization, startCheckoutFlow?: boolean, displayOptions?: DisplayOptions}) => {
        await checkoutDefaultItem({
            group, 
            member, 
            groupOrganization, 
            admin: app === 'dashboard' || app === 'admin', 
            displayOptions, 
            navigate, 
            context: context.value,
            startCheckoutFlow
        });
    }
}

// ----------------------------
// --------- Flow 2 -----------

export function useChooseFamilyMembersForGroup() {
    const navigate = useNavigationActions();
    const context = useContext()

    return async ({group, groupOrganization, family}: {group: Group, groupOrganization: Organization, family: PlatformFamily}) => {
        await navigate.present({
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties('ChooseFamilyMembersForGroupView', {
                        family,
                        group,
                        groupOrganization,
                        async selectionHandler(member: PlatformMember, navigate: NavigationActions) {
                            await checkoutDefaultItem({member, group, groupOrganization, admin: false, navigate, context: context.value});
                        }
                    })
                })
            ]
        })
    }
}



// ----------------------------
// --------- Flow 3 -----------

export async function chooseOrganizationMembersForGroup({members, group, items, context, navigate, owner, deleteRegistrations}: {
    members: PlatformMember[], 
    group: Group, 
    context: SessionContext,
    items?: RegisterItem[], 
    deleteRegistrations?: RegistrationWithMember[],
    navigate: NavigationActions,
    owner: any
}) {
    const groupOrganization = await loadGroupOrganization(context, group.organizationId, owner);

    // Create a new shared checkout for these members
    const checkout = new RegisterCheckout();
    checkout.asOrganizationId = context.organization?.id || null;

    for (const member of members) {
        member.family.checkout = checkout;
        member.family.pendingRegisterItems = [];

        // Add default register item
        if (items === undefined) {
            const item = RegisterItem.defaultFor(member, group, groupOrganization);
            checkout.add(item, {calculate: false});
        }
    }

    if (items !== undefined) {
        for (const item of items) {
            checkout.add(item, {calculate: false});
        }
    }

    if (deleteRegistrations){
        for (const registration of deleteRegistrations) {
            checkout.removeRegistration(registration, {calculate: false});
        }
    }

    checkout.updatePrices()

    await navigate.present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(ChooseOrganizationMembersForGroupView, {
                    members,
                    group,
                    checkout
                })
            })
        ],
        modalDisplayStyle: 'popup'
    })

}

export function useChooseOrganizationMembersForGroup() {
    const navigate = useNavigationActions();
    const context = useContext();
    const owner = useRequestOwner()

    return async ({members, group, items}: {members: PlatformMember[], group: Group, items?: RegisterItem[],}) => {
        return await chooseOrganizationMembersForGroup({members, group, items, navigate, context: context.value, owner});
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
                    selectionHandler: async ({group, groupOrganization}: {group: Group, groupOrganization: Organization}, navigate: NavigationActions) => {
                        await checkoutDefaultItem({member, group, groupOrganization, admin: false, navigate, context});
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
