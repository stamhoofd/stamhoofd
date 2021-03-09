<template>
    <div class="st-view">
        <STNavigationBar :large="true" v-if="false">
            <template slot="left">
                <OrganizationLogo :organization="organization" />
            </template>

            <template slot="right">
                <button class="button text limit-space" @click="openPayments">
                    <span class="icon user" />
                    <span>Account</span>
                </button>

                <button class="button text limit-space" @click="logout">
                    <span class="icon logout" />
                    <span>Uitloggen</span>
                </button>
            </template>
        </STNavigationBar>
        <main class="limit-width">
            <section class="white-top view">
                <main v-if="waitingMembers.length > 0" class="container">
                    <h1>Leden op wachtlijst</h1>
                    <p>Deze leden staan nog op een wachtlijst. We houden je op de hoogte, dan kan je verdere informatie aanvullen en het lidgeld betalen.</p>

                    <STList>
                        <STListItem v-for="member in waitingMembers" :key="member.id" class="right-stack">
                            <span v-if="member.acceptedWaitingGroups.length == 0" slot="left" class="icon clock" />
                            <span v-else slot="left" class="icon green success" />

                            <h2 class="payment-period">
                                {{ member.firstName }} {{ member.details ? member.details.lastName : "" }}
                            </h2>
                            <p v-if="member.waitingGroups.length > 0" class="style-description-small">
                                Op wachtlijst voor {{ member.waitingGroups.map(g => g.settings.name ).join(", ") }}
                            </p>
                            <p v-if="member.acceptedWaitingGroups.length > 0" class="style-description-small">
                                Kan zich nu inschrijven voor {{ member.acceptedWaitingGroups.map(g => g.settings.name ).join(", ") }}
                            </p>

                            <template slot="right">
                                <button v-if="member.acceptedWaitingGroups.length == 0" class="button text limit-space" @click.stop="editMember(member)">
                                    <span class="icon edit" />
                                    <span>Bewerken</span>
                                </button>
                                <button v-else class="button text limit-space" @click.stop="addNewMember">
                                    <span>Inschrijven</span>
                                    <span class="icon arrow-right" />
                                </button>
                            </template>
                        </STListItem>
                    </STList>

                    <STToolbar v-if="registeredMembers.length == 0">
                        <button slot="right" class="primary button" @click="addNewMember">
                            <span class="icon white left add" />
                            <span>Lid inschrijven</span>
                        </button>
                    </STToolbar>
                </main>

                <main v-if="registeredMembers.length > 0" class="container">
                    <h1>Ingeschreven leden</h1>
                    <p>Hier kan je inschrijvingen bewerken of nog iemand anders inschrijven.</p>

                    <STList>
                        <STListItem v-for="member in registeredMembers" :key="member.id" class="right-stack">
                            <span slot="left" class="icon user" />

                            <h2 class="payment-period">
                                {{ member.firstName }} {{ member.details ? member.details.lastName : "" }}
                            </h2>
                            <p class="style-description-small">
                                Ingeschreven voor {{ member.groups.map(g => g.settings.name ).join(", ") }}
                            </p>

                            <template slot="right">
                                <button class="button text limit-space" @click.stop="editMember(member)">
                                    <span class="icon edit" />
                                    <span>Bewerken</span>
                                </button>
                            </template>
                        </STListItem>
                    </STList>
                    <STToolbar>
                        <button slot="right" class="primary button" @click="addNewMember">
                            <span class="icon white left add" />
                            <span>Lid inschrijven</span>
                        </button>
                    </STToolbar>
                </main>
            </section>

            <section class="view gray-shadow">
                <main>
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
import MemberGeneralView from '../registration/MemberGeneralView.vue';
import PaymentsView from "./PaymentsView.vue";
import RegistrationOverviewView from './RegistrationOverviewView.vue';

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

    get rootCategory() {
        return this.organization.categoryTree
    }

    logout() {
        if (SessionManager.currentSession && SessionManager.currentSession.isComplete()) {
            SessionManager.currentSession.logout()
            return;
        }
    }

    openPayments() {
        this.show(new ComponentWithProperties(PaymentsView, {}))
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
        this.show(new ComponentWithProperties(RegistrationOverviewView, {}))
    }

    editMember(member: MemberWithRegistrations) {
        this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(MemberGeneralView, {
                initialMember: member,
                editOnly: true
            })
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