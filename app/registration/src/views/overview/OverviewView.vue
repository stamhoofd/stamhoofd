<template>
    <div class="boxed-view">
        <div class="st-view" v-if="waitingMembers.length > 0">
            <main>
                <h1>Leden op wachtlijst</h1>
                <p>Deze leden staan nog op een wachtlijst. We houden je op de hoogte, dan kan je verdere informatie aanvullen en het lidgeld betalen.</p>

                <STList>
                    <STListItem v-for="member in waitingMembers" :key="member.id" class="right-stack">
                        <span class="icon clock" slot="left" v-if="member.acceptedWaitingGroups.length == 0"/>
                        <span class="icon green success" slot="left" v-else />

                        <h2 class="payment-period">{{ member.firstName }} {{ member.details ? member.details.lastName : "" }}</h2>
                        <p class="style-description-small" v-if="member.waitingGroups.length > 0">Op wachtlijst voor {{ member.waitingGroups.map(g => g.settings.name ).join(", ") }}</p>
                        <p class="style-description-small" v-if="member.acceptedWaitingGroups.length > 0">Kan zich nu inschrijven voor {{ member.acceptedWaitingGroups.map(g => g.settings.name ).join(", ") }}</p>

                        <template slot="right">
                            <button class="button text limit-space" @click.stop="editMember(member)" v-if="member.acceptedWaitingGroups.length == 0">
                                <span class="icon edit" />
                                <span>Bewerken</span>
                            </button>
                            <button class="button text limit-space" @click.stop="addNewMember" v-else>
                                <span>Inschrijven</span>
                                 <span class="icon arrow-right" />
                            </button>
                            
                        </template>
                    </STListItem>
                </STList>

            </main>
            <STToolbar v-if="registeredMembers.length == 0">
                <button class="primary button" slot="right" @click="addNewMember">
                    <span class="icon white left add"/>
                    <span>Lid inschrijven</span>
                </button>
            </STToolbar>
        </div>

        <div class="st-view" v-if="registeredMembers.length > 0">
            <main>
                <h1>Ingeschreven leden</h1>
                <p>Hier kan je inschrijvingen bewerken of nog iemand anders inschrijven.</p>

                <STList>
                    <STListItem v-for="member in registeredMembers" :key="member.id" class="right-stack">
                        <span class="icon user" slot="left" />

                        <h2 class="payment-period">{{ member.firstName }} {{ member.details ? member.details.lastName : "" }}</h2>
                        <p class="style-description-small">Ingeschreven voor {{ member.groups.map(g => g.settings.name ).join(", ") }}</p>

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
                    <STListItem v-for="payment in payments" :key="payment.id" class="right-stack" :selectable="canOpenPayment(payment)" @click="openPayment(payment)">
                        <span class="icon card" slot="left" />

                        <h2 class="style-title-list">{{ getPaymentPeriod(payment) }}</h2>
                        <p class="style-description-small">{{ payment.getMemberNames() }}</p>
                        <p class="style-description-small" v-if="payment.status == 'Succeeded'">
                            {{ payment.method == "Transfer" ? 'Betaald via overschrijving' : 'Betaald via Bancontact' }}
                        </p>
                        <p class="style-description-small" v-else>Betaal via overschrijving {{ payment.transferDescription }}</p>

                        <template slot="right">
                            {{ payment.price | price }}
                            <span v-if="payment.status == 'Succeeded'" class="icon green success" />
                            <span v-else class="icon arrow-right" />
                        </template>
                    </STListItem>
                </STList>

            </main>
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Mixins } from "vue-property-decorator";
import { ComponentWithProperties,NavigationController,NavigationMixin, HistoryManager } from "@simonbackx/vue-app-navigation";
import { STNavigationBar, STToolbar, STList, STListItem, LoadingView, Checkbox, ErrorBox } from "@stamhoofd/components"
import MemberGeneralView from '../registration/MemberGeneralView.vue';
import { MemberManager } from '../../classes/MemberManager';
import { MemberWithRegistrations, Group, Payment, PaymentDetailed, RegistrationWithMember, PaymentMethod } from '@stamhoofd/structures';
import { OrganizationManager } from '../../classes/OrganizationManager';
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
        return this.members.filter(m => m.groups.length > 0)
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
                initialMember: member
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
</style>