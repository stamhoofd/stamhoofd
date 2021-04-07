<template>
    <div class="view-payments">
        <main>
            <Spinner v-if="loadingPayments" />
            <div v-for="payment in payments" v-else :key="payment.id">
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
            </div>
        </main>

        <STToolbar>
            <template #left />
            <template #right>
                <LoadingButton :loading="loading">
                    <button v-if="!member.paid" class="button primary" @click="markPaid">
                        Markeer als betaald
                    </button>
                    <button v-else class="button secundary" @click="markNotPaid">
                        Toch niet betaald
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
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

    async markPaid() {
        if (this.loading) {
            return;
        }

        const data: PaymentPatch[] = []
        for (const payment of this.payments) {
            if (payment.status != PaymentStatus.Succeeded) {
                data.push(PaymentPatch.create({
                    id: payment.id,
                    status: PaymentStatus.Succeeded
                }))
            }
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

    async markNotPaid() {
        if (this.loading) {
            return;
        }

        const data: PaymentPatch[] = []
        for (const payment of this.payments) {
            if (payment.status == PaymentStatus.Succeeded) {
                data.push(PaymentPatch.create({
                    id: payment.id,
                    status: PaymentStatus.Created
                }))
            }
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
    padding: 10px 0;
    flex-grow: 1;
    display: flex;
    flex-direction: column;

    > main > div > h2 {
        @extend .style-title-2;
        margin: 20px 0;
    }
}
</style>
