<template>
    <div class="st-view background">
        <STNavigationBar title="Overschrijvingen">
            <BackButton slot="left" v-if="canPop" @click="pop"/>

            <template #right>
                <input v-model="searchQuery" class="input search" placeholder="Zoeken">
            </template>
        </STNavigationBar>

        <main>
            <h1>Overschrijvingen</h1>
    
            <p class="info-box">Op aanvraag kan je online betalingen accepteren via onze betaalpartner. Transactiekosten zijn 31 cent voor Bancontact en 20 cent voor Payconiq.</p>
            <p class="info-box">We bekijken momenteel een mogelijkheid om in de toekomst automatisch overschrijvingen als betaald te markeren. </p>

            <Spinner v-if="loading"/>
            <STList v-else>
                <STListItem v-for="payment in filteredPayments" :key="payment.payment.id" :selectable="true" class="right-stack right-description" element-name="label">
                    <Checkbox slot="left" v-model="payment.selected"/>

                    <h2 class="style-title-list">{{ payment.payment.registrations.map(r => r.member.details.name).join(", ") }}</h2>
                    <p class="style-description-small">{{ payment.payment.createdAt | date }}</p>
                    <p class="style-description-small">{{ payment.payment.transferDescription }}</p>
                    
                    <template slot="right">
                        <span>{{ payment.payment.price | price }}</span>
                        <span v-if="getPaymentTiming(payment.payment) == 'Succeeded'" class="icon success green" v-tooltip="'Betaald op '+payment.payment.paidAt"></span>
                        <span v-else-if="getPaymentTiming(payment.payment) == 'Pending'" class="icon clock gray" v-tooltip="'Wacht op betaling, zou intussen overgeschreven moeten zijn. Je kan deze al een herinnering sturen.'"></span>
                        <span v-else-if="getPaymentTiming(payment.payment) == 'Late'" class="icon error red" v-tooltip="'Na meer dan een maand nog steeds niet betaald'"></span>
                        <span v-else-if="getPaymentTiming(payment.payment) == 'New'" class="icon new gray" v-tooltip="'Recente inschrijving, betaling kan mogelijks nog niet aangekomen zijn (minder dan 3 werkdagen geleden)'"></span>
                    </template>
                </STListItem>
            </STList>
            
        </main>

        <STToolbar v-if="canMarkNotPaid || canMarkPaid">
            <template #right>
                <LoadingButton :loading="loadingNotPaid" v-if="canMarkNotPaid" >
                    <button class="button" :class="{ secundary: canMarkPaid, primary: !canMarkPaid}" @click="markNotPaid">Niet betaald</button>
                </LoadingButton>
                <LoadingButton :loading="loadingPaid" v-if="canMarkPaid" >
                    <button class="button primary" @click="markPaid">Markeer als betaald</button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>


<script lang="ts">
import { ComponentWithProperties,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox, STList, STListItem, STNavigationBar, STToolbar, CenteredMessage, BackButton, Spinner, TooltipDirective, LoadingButton } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { Group, GroupGenderType,GroupSettings, OrganizationPatch, EncryptedPaymentDetailed, PaymentDetailed, RegistrationWithMember, PaymentStatus, PaymentPatch } from '@stamhoofd/structures';
import { OrganizationGenderType } from '@stamhoofd/structures';
import { Component, Mixins } from "vue-property-decorator";

import EditGroupView from './EditGroupView.vue';
import { OrganizationManager } from '../../../classes/OrganizationManager';
import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { MemberManager } from '../../../classes/MemberManager';
import { Formatter } from '@stamhoofd/utility';

class SelectablePayment {
    payment: PaymentDetailed;
    selected = false;

    constructor(payment: PaymentDetailed) {
        this.payment = payment;
    }
}

@Component({
    components: {
        Checkbox,
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        Spinner,
        BackButton,
        LoadingButton
    },
    filters: {
        price: Formatter.price,
        date: Formatter.date.bind(Formatter)
    },
    directives: {
        tooltip: TooltipDirective
    }
})
export default class PaymentsView extends Mixins(NavigationMixin) {
    SessionManager = SessionManager // needed to make session reactive
    loading = false
    loadingPaid = false
    loadingNotPaid = false
    searchQuery = ""
    payments: SelectablePayment[] = []

    mounted() {
        this.loading = true

        this.loadPayments().catch((e) => {
            console.error(e)
        }).finally(() => {
            this.loading = false
        })
    }

    get filteredPayments(): SelectablePayment[] {
        if (this.searchQuery == "") {
            return this.payments;
        }

        return this.payments.filter((payment: SelectablePayment) => {
            if (payment.payment.matchQuery(this.searchQuery)) {
                return true;
            }
            return false;
        });
    }

    get canMarkPaid() {
        for (const payment of this.payments) {
            if (payment.selected) {
                if (payment.payment.status != PaymentStatus.Succeeded) {
                    return true;
                }
            }
        }
        return false
    }

    get canMarkNotPaid() {
        for (const payment of this.payments) {
            if (payment.selected) {
                if (payment.payment.status == PaymentStatus.Succeeded) {
                    return true;
                }
            }
        }
        return false
    }

    calculateWorkDaysSince(d: Date) {
        const date = new Date(d.getTime())
        const now = new Date()
        now.setHours(12, 0, 0, 0)
        date.setHours(12, 0, 0, 0)

        let days = 0
        while(date < now) {
            if (date.getDay() != 0 && date.getDay() != 6) {
                days++
            }
            date.setDate(date.getDate() + 1)
        }
        return days;
    }

    getPaymentTiming(payment: PaymentDetailed) {
        if (payment.status == PaymentStatus.Succeeded) {
            return "Succeeded"
        }

        if (payment.status == PaymentStatus.Failed) {
            return "Failed"
        }

        const workDays = this.calculateWorkDaysSince(payment.createdAt)
        if (workDays > 20) {
            return "Late"
        }

        // Weekdays between now and creation
        if (workDays > 3) {
            return "Pending"
        }

        return "New"
    }

    getPaymentTimingOrder(payment: PaymentDetailed) {
        switch(this.getPaymentTiming(payment)) {
            case "Failed": return 1;
            case "Late": return 2;
            case "Pending": return 3;
            case "New": return 4;
            case "Succeeded": return 5;
        }
    }

    async setPayments(encryptedPayments: EncryptedPaymentDetailed[]) {
        const organization = OrganizationManager.organization

        // Decrypt data
        const payments: PaymentDetailed[] = []
        for (const encryptedPayment of encryptedPayments) {
            // Create a detailed payment without registrations
            const payment = PaymentDetailed.create({...encryptedPayment, registrations: []})

            // Decrypt the members and add them one by one
            for (const registration of encryptedPayment.registrations) {
                const group = organization.groups.find(g => g.id == registration.groupId)
                if (!group) {
                    // todo: create a fallback group
                    throw new Error("Group not found")
                }

                const [member] = await MemberManager.decryptMembersWithoutRegistrations([registration.member])

                payment.registrations.push(RegistrationWithMember.create({
                    ...registration,
                    member,
                    group,
                    payment
                }))
            }

            payments.push(payment)
        }

        // Sort
        payments.sort((a, b) => {
            const sa = this.getPaymentTimingOrder(a)
            const sb = this.getPaymentTimingOrder(b)

            if (sa == sb) {
                return b.createdAt.getTime() - a.createdAt.getTime()
            }
            return sa - sb;
        })

        this.payments = payments.map(p => new SelectablePayment(p))
    }

    async loadPayments(groupId: string | null = null) {
        const session = SessionManager.currentSession!
        const response = await session.authenticatedServer.request({
            method: "GET",
            path: "/organization/payments",
            decoder: new ArrayDecoder(EncryptedPaymentDetailed as Decoder<EncryptedPaymentDetailed>)
        })

        console.log("Received response. Decryping...")
        await this.setPayments(response.data)
    }

    async markPaid() {
        if (this.loadingPaid) {
            return;
        }

        const data: PaymentPatch[] = []

        for (const payment of this.payments) {
            if (payment.selected && payment.payment.status != PaymentStatus.Succeeded) {
                data.push(PaymentPatch.create({
                    id: payment.payment.id,
                    status: PaymentStatus.Succeeded
                }))
            }
        }

        if (data.length > 0) {
            this.loadingPaid = true
            const session = SessionManager.currentSession!

            try {
                const response = await session.authenticatedServer.request({
                    method: "PATCH",
                    path: "/organization/payments",
                    body: data,
                    decoder: new ArrayDecoder(EncryptedPaymentDetailed as Decoder<EncryptedPaymentDetailed>)
                })
                this.setPayments(response.data)
            } finally {
                this.loadingPaid = false
            }
            
        }
    }

    async markNotPaid() {
        if (this.loadingNotPaid) {
            return;
        }

        const data: PaymentPatch[] = []

        for (const payment of this.payments) {
            if (payment.selected && payment.payment.status != PaymentStatus.Pending) {
                data.push(PaymentPatch.create({
                    id: payment.payment.id,
                    status: PaymentStatus.Pending
                }))
            }
        }

        if (data.length > 0) {
            this.loadingNotPaid = true
            const session = SessionManager.currentSession!

            try {
                const response = await session.authenticatedServer.request({
                    method: "PATCH",
                    path: "/organization/payments",
                    body: data,
                    decoder: new ArrayDecoder(EncryptedPaymentDetailed as Decoder<EncryptedPaymentDetailed>)
                })
                this.setPayments(response.data)
            } finally {
                this.loadingNotPaid = false
            }
            
        }
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use '@stamhoofd/scss/base/text-styles.scss';

</style>
