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

                    <STList>
                        <STListItem v-for="member in members" :key="member.id" class="right-stack" :selectable="true" @click.stop="editMember(member)">
                            <span slot="left" class="icon user" />

                            <h2 class="payment-period">
                                {{ member.firstName }} {{ member.details ? member.details.lastName : "" }}
                            </h2>
                            <p class="style-description-small" v-if="false">
                                Ingeschreven voor {{ member.groups.map(g => g.settings.name ).join(", ") }}
                            </p>
                            <p class="style-description-small">
                                Eén inschrijving in mandje
                            </p>

                            <template slot="right">
                                <span class="icon arrow-right-small gray" />
                            </template>
                        </STListItem>
                    </STList>

                    <STToolbar>
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
                    <GroupTree :category="availableTree" :parentLevel="0" />
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

    /**
     * Return members that are currently registered in
     */
    get waitingMembers() {
        if (!this.members) {
            return []
        }
        return this.members.filter(m => m.waitingGroups.length > 0 || m.acceptedWaitingGroups.length > 0)
    }

    getPaymentPeriod(payment: Payment) {
        return Formatter.capitalizeFirstLetter(Formatter.month(payment.createdAt.getMonth() + 1)) + " " + payment.createdAt.getFullYear()
    }

    paymentMethodName(method: PaymentMethod) {
        switch (method) {
            case PaymentMethod.Transfer: return "Betaald via overschrijving"
            case PaymentMethod.Bancontact: return "Betaald via Bancontact"
            case PaymentMethod.iDEAL: return "Betaald via iDEAL"
            case PaymentMethod.Payconiq: return "Betaald via Payconiq by Bancontact"
        }
        return "Onbekende betaalmethode"
    }

    get payments() {
        if (!this.members) {
            return []
        }

        const payments: Map<string, PaymentDetailed> = new Map()
        const groups = OrganizationManager.organization.groups
        for (const member of this.members) {
            for (const registration of member.registrations) {
                if (!registration.payment) {
                    continue;
                }
                const existing = payments.get(registration.payment.id)
                const group = groups.find(g => g.id == registration.groupId)
                if (!group) {
                    continue;
                }
                const reg = RegistrationWithMember.create(
                    Object.assign({
                        member,
                        group
                    }, registration)
                );
                if (existing) {
                    existing.registrations.push(reg)
                } else {
                    payments.set(registration.payment.id, PaymentDetailed.create(Object.assign({
                        registrations: [reg]
                    }, registration.payment)))
                }
            }
        }
        return Array.from(payments.values())
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

    addNewMember() {
        //this.show(new ComponentWithProperties(RegistrationOverviewView, {}))
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