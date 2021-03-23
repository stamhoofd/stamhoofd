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

                    <p class="info-box" v-else>
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
                <main>
                    <h1>Inschrijven</h1>
                    <p>Suggesties voor bestaande leden. Onderaan deze pagina vind je alle groepen waarvoor je kan inschrijven.</p>
                    <GroupTree :category="availableTree" :parent-level="0" />
                </main>
                <main v-if="false">
                    <GroupTree :category="rootCategory" />
                </main>
            </section>
        </main>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties,HistoryManager,NavigationController,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox, LoadingView, OrganizationLogo,STList, STListItem, STNavigationBar, STToolbar, TransferPaymentView } from "@stamhoofd/components"
import { SessionManager } from "@stamhoofd/networking";
import { MemberWithRegistrations, Payment, PaymentDetailed, PaymentMethod,RegistrationWithMember } from '@stamhoofd/structures';
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

    get availableTree() {
        const tree = OrganizationManager.organization.getCategoryTreeWithDepth(1)
        // Filter the tree

        tree.groups = tree.groups.filter(g => {
            for (const member of this.members) {
                if (member.doesMatchGroup(g, OrganizationManager.organization.meta.categories)) {
                    return true
                }
            }
            return false
        })

        for (const cat of tree.categories) {
            cat.groups = cat.groups.filter(g => {
                for (const member of this.members) {
                    if (member.doesMatchGroup(g, OrganizationManager.organization.meta.categories)) {
                        return true
                    }
                }
                return false
            })
        }
        tree.categories = tree.categories.filter(c => c.groups.length > 0)

        return tree
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