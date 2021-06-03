<template>
    <div class="st-view background">
        <STNavigationBar title="Overschrijvingen">
            <BackButton v-if="canPop" slot="left" @click="pop" />

            <template #right>
                <input v-model="searchQuery" class="input search" placeholder="Zoeken" @input="searchQuery = $event.target.value">
            </template>
        </STNavigationBar>

        <main>
            <h1>Overschrijvingen</h1>
    
            <Spinner v-if="loading" />
            <STList v-else>
                <STListItem v-for="payment in filteredPayments" :key="payment.payment.id" :selectable="true" class="right-stack right-description" element-name="label">
                    <Checkbox slot="left" v-model="payment.selected" />

                    <h2 class="style-title-list">
                        {{ payment.payment.order !== null ? (payment.payment.order.data.customer.name + ' (bestelling #'+ payment.payment.order.number +')') : payment.payment.registrations.map(r => r.member.details.name).join(", ") }}
                    </h2>
                    <p class="style-description-small">
                        {{ payment.payment.createdAt | date }}
                    </p>
                    <p class="style-description-small">
                        {{ getPaymentDescription(payment.payment ) }}
                    </p>
                    
                    <template slot="right">
                        <span>{{ payment.payment.price | price }}</span>
                        <span v-if="getPaymentTiming(payment.payment) == 'Succeeded'" v-tooltip="'Betaald op '+payment.payment.paidAt" class="icon success green" />
                        <span v-else-if="getPaymentTiming(payment.payment) == 'Pending'" v-tooltip="'Wacht op betaling, zou intussen overgeschreven moeten zijn. Je kan deze al een herinnering sturen.'" class="icon clock gray" />
                        <span v-else-if="getPaymentTiming(payment.payment) == 'Late'" v-tooltip="'Na meer dan een maand nog steeds niet betaald'" class="icon error red" />
                        <span v-else-if="getPaymentTiming(payment.payment) == 'New'" v-tooltip="'Recent aangemaakt, betaling kan mogelijks nog niet aangekomen zijn (minder dan 3 werkdagen geleden)'" class="icon new gray" />
                    </template>
                </STListItem>
            </STList>

            <p v-if="!loading && payments.length == 0 && filteredPayments.length == 0" class="info-box">
                Er zijn nog geen overschrijvingen aangemaakt. Deze worden aangemaakt als een lid bij het inschrijven de betaalmethode 'overschrijven' kiest.
            </p>
            <p v-else-if="!loading && filteredPayments.length == 0" class="info-box">
                Geen zoekresultaten
            </p>
        </main>

        <STToolbar v-if="canMarkNotPaid || canMarkPaid">
            <template #right>
                <LoadingButton v-if="canMarkNotPaid" :loading="loadingNotPaid">
                    <button class="button" :class="{ secundary: canMarkPaid, primary: !canMarkPaid}" @click="markNotPaid">
                        Niet betaald
                    </button>
                </LoadingButton>
                <LoadingButton v-if="canMarkPaid" :loading="loadingPaid">
                    <button class="button primary" @click="markPaid">
                        Markeer als betaald
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>


<script lang="ts">
import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { HistoryManager, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, Checkbox, LoadingButton,Spinner, STList, STListItem, STNavigationBar, STToolbar, Toast, TooltipDirective } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { EncryptedPaymentGeneral, PaymentDetailed, PaymentGeneral, PaymentMethod,PaymentPatch, PaymentStatus, RegistrationWithMember, TransferDescriptionType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins } from "vue-property-decorator";

import { MemberManager } from '../../../classes/MemberManager';
import { OrganizationManager } from '../../../classes/OrganizationManager';

class SelectablePayment {
    payment: PaymentGeneral;
    selected = false;

    constructor(payment: PaymentGeneral) {
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

        HistoryManager.setUrl("/transfers")
        document.title = "Stamhoofd - Overschrijvingen"
    }

    get filteredPayments(): SelectablePayment[] {
        if (this.searchQuery == "") {
            return this.payments;
        }

        return this.payments.filter((payment: SelectablePayment) => {
            if (payment.payment.matchQuery(this.searchQuery)) {
                return true;
            }

            if (payment.payment.order && (payment.payment.order.number+"" == this.searchQuery || payment.payment.order.data.matchQuery(this.searchQuery))) {
                return true
            }
            return false;
        });
    }

    getPaymentDescription(payment: PaymentGeneral) {
        if (payment.order) {
            return payment.transferDescription 
        }
        if (OrganizationManager.organization.meta.transferSettings.type === TransferDescriptionType.Reference) {
            return payment.transferDescription + " "+ payment.getMemberLastNames()
        }
        return payment.transferDescription 
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

     async appendPayments(encryptedPayments: EncryptedPaymentGeneral[]) {
        const organization = OrganizationManager.organization

        // Decrypt data
        const payments = new Map<string, SelectablePayment>()

        for (const payment of this.payments) {
            payments.set(payment.payment.id, payment)
        }

        for (const encryptedPayment of encryptedPayments) {
            // Create a detailed payment without registrations
            const payment = PaymentGeneral.create({
                ...encryptedPayment, 
                registrations: await MemberManager.decryptRegistrationsWithMember(encryptedPayment.registrations, organization.groups)
            })

            // Set payment reference
            for (const registration of payment.registrations) {
                registration.payment = payment
            }

            
            payments.set(payment.id, new SelectablePayment(payment))
        }

        const arr = [...payments.values()]

        // Sort
        arr.sort((a, b) => {
            const sa = this.getPaymentTimingOrder(a.payment)
            const sb = this.getPaymentTimingOrder(b.payment)

            if (sa == sb) {
                return b.payment.createdAt.getTime() - a.payment.createdAt.getTime()
            }
            return sa - sb;
        })

        this.payments = arr
    }

    async setPayments(encryptedPayments: EncryptedPaymentGeneral[]) {
        encryptedPayments = encryptedPayments.filter(p => p.method == PaymentMethod.Transfer)
        const organization = OrganizationManager.organization

        // Decrypt data
        const payments: PaymentGeneral[] = []
        for (const encryptedPayment of encryptedPayments) {
            // Create a detailed payment without registrations
            const payment = PaymentGeneral.create({
                ...encryptedPayment, 
                registrations: await MemberManager.decryptRegistrationsWithMember(encryptedPayment.registrations, organization.groups)
            })

            // Set payment reference
            for (const registration of payment.registrations) {
                registration.payment = payment
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
            decoder: new ArrayDecoder(EncryptedPaymentGeneral as Decoder<EncryptedPaymentGeneral>)
        })

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
                    decoder: new ArrayDecoder(EncryptedPaymentGeneral as Decoder<EncryptedPaymentGeneral>)
                })
                await this.appendPayments(response.data)
            } catch(e) {
                Toast.fromError(e).show()
            }
            this.loadingPaid = false
        }
    }

    async markNotPaid() {
        if (this.loadingNotPaid) {
            return;
        }

        const data: PaymentPatch[] = []

        for (const payment of this.payments) {
            if (payment.selected && payment.payment.status != PaymentStatus.Created) {
                data.push(PaymentPatch.create({
                    id: payment.payment.id,
                    status: PaymentStatus.Created
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
                    decoder: new ArrayDecoder(EncryptedPaymentGeneral as Decoder<EncryptedPaymentGeneral>)
                })
                await this.appendPayments(response.data)
            } catch(e) {
                Toast.fromError(e).show()
            }
            this.loadingNotPaid = false
        }
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use '@stamhoofd/scss/base/text-styles.scss';

</style>
