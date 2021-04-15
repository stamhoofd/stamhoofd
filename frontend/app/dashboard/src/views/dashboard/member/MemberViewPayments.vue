<template>
    <div class="view-payments">
        <main>
            <Spinner v-if="loadingPayments" />
            <div v-for="(payment, index) in payments" v-else :key="payment.id" class="container">
                <hr v-if="index > 0">
                <h2>Afrekening</h2>

                <dl class="details-grid">
                    <dt>
                        Inschrijvingen
                    </dt>
                    <dd>{{ paymentDescription(payment) }}</dd>

                    <dt>Bedrag</dt>
                    <dd>{{ payment.price | price }}</dd>

                    <dt>Datum</dt>
                    <dd>{{ payment.createdAt | date }}</dd>

                    <template v-if="payment.method == 'Transfer'">
                        <dt>Bankrekening</dt>
                        <dd>{{ organization.meta.transferSettings.iban }}</dd>

                        <dt>Mededeling</dt>
                        <dd>{{ payment.transferDescription }}</dd>
                    </template>

                    <template v-if="payment.method == 'Bancontact'">
                        <dt>Betaald via </dt>
                        <dd>Bancontact</dd>
                    </template>

                    <template v-if="payment.method == 'iDEAL'">
                        <dt>Betaald via </dt>
                        <dd>iDEAL</dd>
                    </template>

                    <template v-if="payment.method == 'Payconiq'">
                        <dt>Betaald via </dt>
                        <dd>Payconiq</dd>
                    </template>

                    <template v-if="payment.method == 'Unknown'">
                        <dt>Betaalmethode</dt>
                        <dd>Onbekend</dd>
                    </template>

                    <dt>Status</dt>
                    <dd v-if="payment.status == 'Succeeded'">
                        Betaald
                    </dd>
                    <dd v-else>
                        Nog niet betaald
                    </dd>
                </dl>

                <p v-if="payment.status == 'Succeeded' && payment.paidAt" class="success-box">
                    Betaald op {{ payment.paidAt | date }}
                </p>

                <LoadingButton :loading="loading">
                    <button v-if="payment.status == 'Succeeded' && payment.paidAt" class="button secundary" @click="markNotPaid(payment)">
                        Toch niet betaald
                    </button>
                    <button v-else class="button primary" @click="markPaid(payment)">
                        Markeer als betaald
                    </button>
                </LoadingButton>
            </div>
        </main>
    </div>
</template>

<script lang="ts">
import { ArrayDecoder,Decoder } from '@simonbackx/simple-encoding';
import { CenteredMessage, LoadingButton,Spinner,STToolbar, Toast } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { EncryptedPaymentDetailed, MemberWithRegistrations, PaymentDetailed, PaymentPatch, PaymentStatus } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Prop,Vue } from "vue-property-decorator";

import { FamilyManager } from '../../../classes/FamilyManager';
import { MemberManager } from '../../../classes/MemberManager';
import { OrganizationManager } from '../../../classes/OrganizationManager';

@Component({ 
    components: { 
        STToolbar,
        LoadingButton,
        Spinner
    },
    filters: {
        price: Formatter.price,
        date: Formatter.dateTime.bind(Formatter)
    }
})
export default class MemberViewPayments extends Vue {
    @Prop()
    member!: MemberWithRegistrations;

    @Prop()
    familyManager!: FamilyManager;
    
    loading = false
    loadingPayments = true

    payments: PaymentDetailed[] = []

    organization = OrganizationManager.organization

    mounted() {
        this.reload().catch(e => {
            console.error(e)
        })
    }

    paymentDescription(payment: PaymentDetailed) {
        return payment.getRegistrationList()
    }

    async reload() {
        this.loadingPayments = true
        try {
            const session = SessionManager.currentSession!
            const response = await session.authenticatedServer.request({
                method: "GET",
                path: "/organization/members/"+this.member.id+"/payments",
                decoder: new ArrayDecoder(EncryptedPaymentDetailed as Decoder<EncryptedPaymentDetailed>)
            })
            await this.setPayments(response.data)
        } catch (e) {
            Toast.fromError(e).show()
        }
        this.loadingPayments = false
    }

    async setPayments(encryptedPayments: EncryptedPaymentDetailed[]) {
        const organization = OrganizationManager.organization

        // Decrypt data
        const payments: PaymentDetailed[] = []
        for (const encryptedPayment of encryptedPayments) {
            // Create a detailed payment without registrations
            const payment = PaymentDetailed.create({
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
            return b.createdAt.getTime() - a.createdAt.getTime()
        })

        this.payments = payments
    }

    async markPaid(payment: PaymentDetailed) {
        if (this.loading) {
            return;
        }

        const data: PaymentPatch[] = []
        if (payment.status != PaymentStatus.Succeeded) {
            data.push(PaymentPatch.create({
                id: payment.id,
                status: PaymentStatus.Succeeded
            }))
        }

        if (data.length > 0) {
            if (!await CenteredMessage.confirm("Ben je zeker dat deze betaling uitgevoerd is?", "Markeer als betaald")) {
                return;
            }
            this.loading = true
            const session = SessionManager.currentSession!

            try {
                const response = await session.authenticatedServer.request({
                    method: "PATCH",
                    path: "/organization/payments",
                    body: data,
                    decoder: new ArrayDecoder(EncryptedPaymentDetailed as Decoder<EncryptedPaymentDetailed>)
                })
                this.updatePayments(response.data)
                MemberManager.callListeners("payment", this.member)
            } catch (e) {
                Toast.fromError(e).show()
            }
            this.loading = false
            
        }
    }

    updatePayments(payments: EncryptedPaymentDetailed[]) {
        for (const payment of payments) {
            // We loop all members of this family because they might have shared payments
            for (const memberPayment of this.payments) {
                if (payment.id == memberPayment.id) {
                    // Copy usefull data
                    memberPayment.status = payment.status
                    memberPayment.paidAt = payment.paidAt

                    memberPayment.transferDescription = payment.transferDescription
                    memberPayment.price = payment.price
                    memberPayment.method = payment.method
                    memberPayment.updatedAt = payment.updatedAt
                    memberPayment.createdAt = payment.createdAt
                }
            }
        }
    }

    async markNotPaid(payment: PaymentDetailed) {
        if (this.loading) {
            return;
        }

        const data: PaymentPatch[] = []
        if (payment.status == PaymentStatus.Succeeded) {
            data.push(PaymentPatch.create({
                id: payment.id,
                status: PaymentStatus.Created
            }))
        }

        if (data.length > 0) {
            if (!await CenteredMessage.confirm("Ben je zeker dat deze betaling niet uitgevoerd is?", "Markeer als niet betaald")) {
                return;
            }

            this.loading = true
            const session = SessionManager.currentSession!

            try {
                const response = await session.authenticatedServer.request({
                    method: "PATCH",
                    path: "/organization/payments",
                    body: data,
                    decoder: new ArrayDecoder(EncryptedPaymentDetailed as Decoder<EncryptedPaymentDetailed>)
                })

                this.updatePayments(response.data)
                MemberManager.callListeners("payment", this.member)
            } catch (e) {
                Toast.fromError(e).show()
            }
            this.loading = false
            
        }
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use '@stamhoofd/scss/base/text-styles.scss';

.view-payments {
    flex-grow: 1;
    display: flex;
    flex-direction: column;

    > main > div {
        @extend .main-text-container;
    }

    .details-grid {
        margin-bottom: 15px;
    }
}
</style>
