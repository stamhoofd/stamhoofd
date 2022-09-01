<template>
    <div class="st-view">
        <STNavigationBar :large="true" :sticky="false" class="only-tab-bar">
            <template slot="left">
                <OrganizationLogo :organization="organization" />
            </template>
        </STNavigationBar>
        <main class="limit-width">
            <section class="white-top view shade">
                <main class="container">
                    <h1>Leden bewerken en inschrijven</h1>

                    <p v-for="invite of invites" :key="invite.id" class="info-box icon email with-button selectable" @click="registerMember(invite.member)">
                        Je hebt een uitnodiging gekregen om {{ invite.member.firstName }} in te schrijven voor {{ invite.group.settings.name }}. Nu staat {{ invite.member.firstName }} nog op de wachtlijst.
                        <span class="button text selected">
                            <span>Inschrijven</span>
                            <span class="icon arrow-right" />
                        </span>
                    </p>

                    <STList v-if="members.length > 0">
                        <STListItem v-for="member in members" :key="member.id" class="right-stack" :selectable="true" @click.stop="editMember(member)">
                            <span slot="left" class="icon user" />

                            <h2 class="payment-period">
                                {{ member.firstName }} {{ member.details ? member.details.lastName : "" }}
                            </h2>
                            <p v-if="member.groups.length > 0" class="style-description-small">
                                Ingeschreven voor {{ member.groups.map(g => g.settings.name ).join(", ") }}
                            </p>
                            <p v-else class="style-description-small">
                                Nog niet ingeschreven
                            </p>

                            <template slot="right">
                                <span class="icon arrow-right-small gray" />
                            </template>
                        </STListItem>
                    </STList>

                    <p v-else-if="!createMemberDisabled" class="info-box">
                        Je hebt nog geen leden ingeschreven op dit account. Voeg ze toe met de knop hieronder.
                    </p>
                </main>
                <STToolbar v-if="!createMemberDisabled" :sticky="false">
                    <button slot="right" class="button secundary full" type="button" @click="addNewMember">
                        <span class="icon left add" />
                        <span>Nieuw lid inschrijven</span>
                    </button>
                </STToolbar>
            </section>

            <section class="view gray-shadow">
                <main v-if="shouldShowSuggestions">
                    <h1>
                        Suggesties
                        <span class="icon star yellow" />
                    </h1>
                    <GroupTree :category="availableTree" :parent-level="0" />
                    <hr>
                </main>
                <main>
                    <GroupTree :category="fullTree" />
                </main>
            </section>
        </main>
    </div>
</template>

<script lang="ts">
import { Decoder } from "@simonbackx/simple-encoding";
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Checkbox, GlobalEventBus, LoadingView, OrganizationLogo, PromiseView, STList, STListItem, STNavigationBar, STToolbar, TransferPaymentView } from "@stamhoofd/components";
import { SessionManager, UrlHelper } from "@stamhoofd/networking";
import { EncryptedPaymentDetailed, MemberWithRegistrations, Payment, PaymentDetailed, PaymentMethod, PaymentStatus } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins } from "vue-property-decorator";

import { MemberManager } from '../../classes/MemberManager';
import { OrganizationManager } from '../../classes/OrganizationManager';
import GroupTree from '../../components/GroupTree.vue';
import { BuiltInEditMemberStep, EditMemberStepsManager, EditMemberStepType } from "../members/details/EditMemberStepsManager";
import MemberChooseGroupsView from "../members/MemberChooseGroupsView.vue";
import MemberView from "../members/MemberView.vue";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        LoadingView,
        Checkbox,
        GroupTree,
        OrganizationLogo
    },
    filters: {
        price: Formatter.price
    }
})
export default class OverviewView extends Mixins(NavigationMixin){
    MemberManager = MemberManager

    /**
     * Return members that are currently registered in
     */
    get registeredMembers() {
        if (!this.members) {
            return []
        }
        return this.members.filter(m => m.groups.length > 0)
    }

    get organization() {
        return OrganizationManager.organization
    }

    get fullTree() {
        return OrganizationManager.organization.categoryTree.filterForDisplay(SessionManager.currentSession!.user!.permissions !== null, this.organization.meta.packages.useActivities)
    }

    get shouldShowSuggestions() {
        if (this.members.length == 0) {
            return false
        }
        if (this.availableTree.categories.length == 0) {
            return false
        }

        if (this.availableTree.getAllGroups().length > 2) {
            // Too many suggestions
            return false
        }

        return true
    }

    get availableTree() {
        const tree = OrganizationManager.organization.getCategoryTreeWithDepth(1)
        // Filter the tree

        tree.groups = tree.groups.filter(g => {
            for (const member of this.members) {
                if (member.shouldShowGroup(g, OrganizationManager.organization.groups, OrganizationManager.organization.meta.categories)) {
                    return true
                }
            }
            return false
        })

        for (const cat of tree.categories) {
            cat.groups = cat.groups.filter(g => {
                for (const member of this.members) {
                    if (member.shouldShowGroup(g, OrganizationManager.organization.groups, OrganizationManager.organization.meta.categories)) {
                        return true
                    }
                }
                return false
            })
        }

        return tree.filterForDisplay(SessionManager.currentSession!.user!.permissions !== null, this.organization.meta.packages.useActivities)
    }

    logout() {
        if (SessionManager.currentSession && SessionManager.currentSession.isComplete()) {
            SessionManager.currentSession.logout()
            return;
        }
    }

    get members() {
        if (MemberManager.members) {
            return MemberManager.members
        }
        return []
    }
    
    get createMemberDisabled() {  //vereniging c69512bc-ea0c-427a-ab90-08c3dcf1c856 biedt ouders geen knop om zelf een lid aan te maken
        return this.organization.id === "c69512bc-ea0c-427a-ab90-08c3dcf1c856"
    }
    
    get invites() {
        return this.members.flatMap(member => {
            return member.acceptedWaitingGroups.map(group => {
                return {
                    id: member.id+"-"+group.id,
                    member,
                    group
                }
            })
            
        })
    }

    mounted() {
        const parts =  UrlHelper.shared.getParts()
        const searchParams = UrlHelper.shared.getSearchParams()
        UrlHelper.setUrl("/")
        document.title = "Ledenportaal - " + this.organization.name
        
        let didShow = false

        if (parts.length == 1 && parts[0] == 'payment' && searchParams.get("id")) {
            UrlHelper.shared.clear()

            const paymentId = searchParams.get("id")
            didShow = true

            const session = SessionManager.currentSession!
            // tood: password reset view
            const component = new ComponentWithProperties(NavigationController, { 
                root: new ComponentWithProperties(PromiseView, {
                    promise: async () => {
                        const PaymentPendingView = (await import(/* webpackChunkName: "Checkout" */ "@stamhoofd/components/src/views/PaymentPendingView.vue")).default
                        return new ComponentWithProperties(PaymentPendingView, {
                            server: session.authenticatedServer,
                            paymentId,
                            finishedHandler: async function(this: NavigationMixin, payment: Payment | null) {
                                if (payment && payment.status == PaymentStatus.Succeeded) {
                                    const RegistrationSuccessView = (await import(/* webpackChunkName: "Checkout" */ "../checkout/RegistrationSuccessView.vue")).default
                                    const response = await session.authenticatedServer.request({
                                        method: "GET",
                                        path: "/payments/"+payment.id+"/registrations",
                                        decoder: EncryptedPaymentDetailed as Decoder<EncryptedPaymentDetailed>
                                    })
                                    const registrations = MemberManager.decryptRegistrationsWithMember(response.data.registrations, OrganizationManager.organization.groups)

                                    this.show({
                                        components: [
                                            new ComponentWithProperties(RegistrationSuccessView, {
                                                registrations
                                            })
                                        ], 
                                        replace: 1, 
                                        force: true
                                    })

                                } else {
                                    UrlHelper.setUrl("/")
                                    this.dismiss({ force: true })
                                    new CenteredMessage("Betaling mislukt", "De betaling werd niet voltooid of de bank heeft de betaling geweigerd. Probeer het opnieuw.", "error").addCloseButton().show()
                                }
                            }
                        })
                    }
                })
            })
            this.present(component.setAnimated(false))
        }
    }

    async addNewMember() {
        // Only ask details + parents for new members
        // We'll ask the other things when selecting the details
        const stepManager = new EditMemberStepsManager(
            [
                new BuiltInEditMemberStep(EditMemberStepType.Details, true),
                new BuiltInEditMemberStep(EditMemberStepType.Parents, true)
            ], 
            [],
            undefined,
            (component: NavigationMixin) => {
                // when we are ready, show the 'choose group' view for this member
                if (stepManager.editMember) {
                    component.show({
                        components: [
                            new ComponentWithProperties(MemberChooseGroupsView, {
                                member: stepManager.editMember 
                            })
                        ],
                        replace: component.navigationController?.components.length ?? 1,
                        force: true
                    })
                } else {
                    // uhm?
                    // default to dismiss
                    console.error("Missing edit member at the end of edit member flow")
                    component.dismiss({ force: true })
                }
                return Promise.resolve()
            }
        )
        const component = await stepManager.getFirstComponent()
        this.present(new ComponentWithProperties(NavigationController, {
            root: component
        }).setDisplayStyle("popup"))
    }

    editMember(member: MemberWithRegistrations) {
        this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(MemberView, { member })
        }).setDisplayStyle("popup"))
    }

    registerMember(member: MemberWithRegistrations) {
        this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(MemberChooseGroupsView, { member })
        }).setDisplayStyle("popup"))
    }

    canOpenPayment(payment: PaymentDetailed) {
        return payment.method == PaymentMethod.Transfer
    }

    openPayment(payment: PaymentDetailed) {
        if (!this.canOpenPayment(payment)) {
            return;
        }
        this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(TransferPaymentView, {
                type: "registration",
                organization: OrganizationManager.organization,
                payment,
                settings: OrganizationManager.organization.meta.transferSettings,
                isPopup: true
            })
        }).setDisplayStyle("popup"))
    }
}
</script>
