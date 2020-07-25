<template>
    <div class="boxed-view">
        <div class="st-view">
            <main>
                <h1>Ingeschreven leden</h1>
                <p>Hier kan je inschrijvingen bewerken of nog iemand anders inschrijven.</p>

                <STList>
                    <STListItem v-for="member in registeredMembers" :key="member.id" class="right-stack">
                        <span class="icon user" slot="left" />

                        <h2 class="payment-period">{{ member.details.name }}</h2>
                        <p class="style-description-small">{{ member.groups.map(g => g.settings.name ).join(", ") }}</p>

                        <template slot="right">
                            <button class="button text limit-space" @click.stop="editMember(member)">
                                <span class="icon edit" />
                                <span>Bewerken</span>
                            </button>
                            
                        </template>
                    </STListItem>
                </STList>

            </main>
            <STToolbar>
                <button class="primary button" slot="right" @click="addNewMember">
                    <span class="icon white left add"/>
                    <span>Lid inschrijven</span>
                </button>
            </STToolbar>
        </div>

        <div class="st-view payments-overview-view" v-if="payments.length > 0">
            <main>
                <h1>Afrekeningen</h1>
                <p>Hier kan je de betaalstatus van jouw inschrijvingen opvolgen.</p>

                <STList>
                    <STListItem v-for="payment in payments" :key="payment.id" class="right-stack" :selectable="true" @click="openPayment(payment)">
                        <span class="icon card" slot="left" />

                        <h2 class="payment-period">{{ getPaymentPeriod(payment) }}</h2>
                        <p class="style-description-small">{{ payment.getMemberNames() }}</p>
                        <p class="style-description-small">Via overschrijving {{ payment.transferDescription }}</p>

                        <template slot="right">
                            {{ payment.price | price }}
                            <span class="icon arrow-right" />
                        </template>
                    </STListItem>
                </STList>

            </main>
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Mixins } from "vue-property-decorator";
import { ComponentWithProperties,NavigationController,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { STNavigationBar, STToolbar, STList, STListItem, LoadingView, Checkbox, ErrorBox } from "@stamhoofd/components"
import MemberGeneralView from '../registration/MemberGeneralView.vue';
import { MemberManager } from '../../classes/MemberManager';
import { MemberWithRegistrations, Group, Payment, PaymentDetailed, RegistrationWithMember } from '@stamhoofd/structures';
import { OrganizationManager } from '../../../../dashboard/src/classes/OrganizationManager';
import MemberGroupView from '../registration/MemberGroupView.vue';
import { SimpleError } from '@simonbackx/simple-errors';
import FinancialProblemsView from './FinancialProblemsView.vue';
import { Formatter } from '@stamhoofd/utility';
import TransferPaymentView from './TransferPaymentView.vue';
import RegistrationOverviewView from './RegistrationOverviewView.vue';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        LoadingView,
        Checkbox
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
        return this.members.filter(m => m.activeRegistrations.length > 0)
    }

    getPaymentPeriod(payment: Payment) {
        return Formatter.capitalizeFirstLetter(Formatter.month(payment.createdAt.getMonth() + 1)) + " " + payment.createdAt.getFullYear()
    }

    get payments() {
        if (!this.members) {
            return []
        }

        const payments: Map<string, PaymentDetailed> = new Map()
        const groups = OrganizationManager.organization.groups
        for (const member of this.members) {
            for (const registration of member.registrations) {
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

    memberGetGroup(member: MemberWithRegistrations): Group | null {
        if (!member.details) {
            return null
        }

        const groups = OrganizationManager.organization.groups
        return member.details.getPreferredGroup(groups)
    }

    addNewMember() {
        this.show(new ComponentWithProperties(RegistrationOverviewView, {}))
    }

    editMember(member: MemberWithRegistrations) {
        this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(MemberGeneralView, {
                member
            })
        }).setDisplayStyle("popup"))
    }

    openPayment(payment: PaymentDetailed) {
            this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(TransferPaymentView, {
                payment,
                isPopup: true
            })
        }).setDisplayStyle("popup"))
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.payments-overview-view {
    .payment-period {
        padding-bottom: 4px;
    }
}
</style>