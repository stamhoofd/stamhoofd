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

                    <p v-for="invite of invites" :key="invite.id" class="info-box email with-button selectable" @click="registerMember(invite.member)">
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

                    <p v-else class="info-box">
                        Je hebt nog geen leden ingeschreven op dit account. Voeg ze toe met de knop hieronder.
                    </p>

                    <STToolbar :sticky="false">
                        <button slot="right" class="button secundary full" @click="addNewMember">
                            <span class="icon left add" />
                            <span>Nieuw lid toevoegen</span>
                        </button>
                    </STToolbar>
                </main>
            </section>

            <section class="view gray-shadow">
                <main v-if="!isEmpty">
                    <h1>
                        Suggesties
                        <span class="icon star yellow" />
                    </h1>
                    <p>
                        Kies een groep waarvoor je je wilt inschrijven of klik bovenaan op een lid dat je wilt inschrijven (dan zie je de suggesties).
                    </p>
                    <GroupTree :category="availableTree" :parent-level="0" />
                    <hr>
                </main>
                <main v-else>
                    <p v-if="members.length > 0" class="warning-box">
                        Je kan je momenteel nergens voor inschrijven, maar je kan eventueel wel een nieuw lid toevoegen.
                    </p>
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
import { ComponentWithProperties,HistoryManager,ModalStackComponent,NavigationController,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Checkbox, GlobalEventBus, LoadingView, OrganizationLogo,PromiseView,STList, STListItem, STNavigationBar, STToolbar, Toast, TransferPaymentView } from "@stamhoofd/components"
import { Sodium } from "@stamhoofd/crypto";
import { LoginHelper, SessionManager } from "@stamhoofd/networking";
import { EncryptedPaymentDetailed, Member, MemberWithRegistrations, Payment, PaymentDetailed, PaymentMethod, PaymentStatus } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins } from "vue-property-decorator";

import { MemberManager } from '../../classes/MemberManager';
import { OrganizationManager } from '../../classes/OrganizationManager';
import GroupTree from '../../components/GroupTree.vue';
import { EditMemberStepsManager, EditMemberStepType } from "../members/details/EditMemberStepsManager";
import MemberChooseGroupsView from "../members/MemberChooseGroupsView.vue";
import MemberView from "../members/MemberView.vue";
import MissingKeyView from "./MissingKeyView.vue";

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

    get isEmpty() {
        if (this.members.length == 0) {
            return true
        }
        return (this.availableTree.categories.length == 0)
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
        const path = window.location.pathname;
        const parts = path.substring(1).split("/");
        let setPath = true

        if (parts.length == 1 && parts[0] == 'payment') {
            setPath = false
            const session = SessionManager.currentSession!
            // tood: password reset view
            const component = new ComponentWithProperties(NavigationController, { 
                root: new ComponentWithProperties(PromiseView, {
                    promise: async () => {
                        const PaymentPendingView = (await import(/* webpackChunkName: "Checkout" */ "@stamhoofd/components/src/views/PaymentPendingView.vue")).default
                        return new ComponentWithProperties(PaymentPendingView, {
                            server: session.authenticatedServer,
                            paymentId: new URL(window.location.href).searchParams.get("id"),
                            finishedHandler: async function(this: NavigationMixin, payment: Payment | null) {
                                if (payment && payment.status == PaymentStatus.Succeeded) {
                                    const RegistrationSuccessView = (await import(/* webpackChunkName: "Checkout" */ "../checkout/RegistrationSuccessView.vue")).default
                                    const response = await session.authenticatedServer.request({
                                        method: "GET",
                                        path: "/payments/"+payment.id+"/registrations",
                                        decoder: EncryptedPaymentDetailed as Decoder<EncryptedPaymentDetailed>
                                    })
                                    const registrations = await MemberManager.decryptRegistrationsWithMember(response.data.registrations, OrganizationManager.organization.groups)
                                    this.navigationController!.push(new ComponentWithProperties(RegistrationSuccessView, {
                                        registrations
                                    }), true, 1)
                                } else {
                                    HistoryManager.setUrl("/")
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

        if (setPath) {
            HistoryManager.setUrl("/")
        }

        if (setPath && this.members.find(m => m.details.isRecovered)) {
            // Show error message
            this.present(new ComponentWithProperties(MissingKeyView).setDisplayStyle("sheet"))
        }
    }

    activated() {
        GlobalEventBus.addListener(this, "encryption", async () => {
            // Reload members if encryption key changed
            await MemberManager.loadMembers()
        })
    }

    deactivated() {
        GlobalEventBus.removeListener(this)
    }

    async addNewMember() {
        // Only ask details + parents for new members
        // We'll ask the other things when selecting the details
        const stepManager = new EditMemberStepsManager(
            [
                EditMemberStepType.Details,
                EditMemberStepType.Parents
            ], 
            undefined,
            (component: NavigationMixin) => {
                // when we are ready, show the 'choose group' view for this member
                if (stepManager.editMember) {
                    component.show(
                        new ComponentWithProperties(MemberChooseGroupsView, { member: stepManager.editMember })
                    )
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
                additionalReference: payment.getMemberLastNames(),
                isPopup: true
            })
        }).setDisplayStyle("popup"))
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;
</style>