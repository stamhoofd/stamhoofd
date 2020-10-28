<template>
    <div class="view-payments">
        <main>
            <div v-for="payment in payments">
                <h2>Betaling</h2>
                <dl class="details-grid">
                    <dt>Bedrag</dt>
                    <dd>{{ payment.price | price }}</dd>

                    <template v-if="payment.method == 'Transfer'">
                        <dt>Bankrekening</dt>
                        <dd>{{ organization.meta.iban }}</dd>

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
import { LoadingButton,STToolbar } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { EncryptedPaymentDetailed,MemberWithRegistrations, PaymentPatch, PaymentStatus } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Prop,Vue } from "vue-property-decorator";

import { FamilyManager } from '../../../classes/FamilyManager';
import { MemberManager } from '../../../classes/MemberManager';
import { OrganizationManager } from '../../../classes/OrganizationManager';

@Component({ 
    components: { 
        STToolbar,
        LoadingButton
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

    organization = OrganizationManager.organization

    get payments() {
        return this.member.registrations.flatMap(r => r.payment ? [r.payment] : [])
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
            if (!confirm("Ben je zeker dat deze overschrijving uitgevoerd is?")) {
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
            } finally {
                this.loading = false
            }
            
        }
    }

    updatePayments(payments: EncryptedPaymentDetailed[]) {
        for (const payment of payments) {
            // We loop all members of this family because they might have shared payments
            for (const member of this.familyManager.members) {
                for (const r of member.registrations) {
                    const memberPayment = r.payment
                    if (memberPayment && payment.id == memberPayment.id) {
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
            if (!confirm("Ben je zeker dat deze overschrijving niet uitgevoerd is?")) {
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
            } finally {
                this.loading = false
            }
            
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
