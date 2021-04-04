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

                    <p class="info-box email with-button selectable" v-for="invite of invites" :key="invite.id" @click="registerMember(invite.member)">
                        Je hebt een uitnodiging gekregen om in te schrijven voor {{ invite.group.settings.name }}. Nu staat {{ invite.member.firstName }} op de wachtlijst, maar je kan de inschrijving afwerken.
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
                    <GroupTree v-if="!isEmpty && filterActive" :category="availableTree" :parent-level="0" />
                    <GroupTree v-else :category="fullTree" :parent-level="0" />
                    <hr>
                </main>
                <main v-else>
                    <p class="warning-box">
                        Dit zijn alle beschikbare inschrijvingsgroepen. Je kan je momenteel nergens voor inschrijven, maar je kan eventueel wel een nieuw lid toevoegen.
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
import { ComponentWithProperties,HistoryManager,NavigationController,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox, LoadingView, OrganizationLogo,STList, STListItem, STNavigationBar, STToolbar, TransferPaymentView } from "@stamhoofd/components"
import { SessionManager } from "@stamhoofd/networking";
import { MemberWithRegistrations, PaymentDetailed, PaymentMethod } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins } from "vue-property-decorator";

import { MemberManager } from '../../classes/MemberManager';
import { OrganizationManager } from '../../classes/OrganizationManager';
import GroupTree from '../../components/GroupTree.vue';
import { EditMemberStepsManager, EditMemberStepType } from "../members/details/EditMemberStepsManager";
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
    filterActive = true

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
        return OrganizationManager.organization.categoryTree.filterForDisplay(SessionManager.currentSession!.user!.permissions !== null)
    }

    get isEmpty() {
        if (this.members.length == 0) {
            return true
        }
        return (this.fullTree.categories.length == 0)
    }

    get availableTree() {
        const tree = OrganizationManager.organization.getCategoryTreeWithDepth(1)
        // Filter the tree

        tree.groups = tree.groups.filter(g => {
            for (const member of this.members) {
                if (member.shouldShowGroup(g, OrganizationManager.organization.meta.categories)) {
                    return true
                }
            }
            return false
        })

        for (const cat of tree.categories) {
            cat.groups = cat.groups.filter(g => {
                for (const member of this.members) {
                    if (member.shouldShowGroup(g, OrganizationManager.organization.meta.categories)) {
                        return true
                    }
                }
                return false
            })
        }

        return tree.filterForDisplay(SessionManager.currentSession!.user!.permissions !== null)
    }

    showAllGroups() {
        this.filterActive = false
    }

    get rootCategory() {
        const tree = this.organization.categoryTree

        return tree
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
        HistoryManager.setUrl("/")
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