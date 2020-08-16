<template>
    <div class="view-payments">
        <main>
            <div v-for="payment in payments" >
                <h2>Betaling <span class="icon success green" v-if="payment.status == 'Succeeded'"/></h2>
                <dl class="details-grid" >
                    <dt>Bedrag</dt>
                    <dd>{{ payment.price | price }}</dd>

                    <dt>Bankrekening</dt>
                    <dd>{{ organization.meta.iban }}</dd>

                    <dt>Mededeling</dt>
                    <dd>{{ payment.transferDescription }}</dd>

                    <dt>Status</dt>
                    <dd v-if="payment.status == 'Succeeded'">
                        Betaald
                    </dd>
                    <dd v-else>
                        Nog niet betaald
                    </dd>
                </dl>
            </div>
        </main>

        <STToolbar>
            <template #left />
            <template #right>
                <LoadingButton :loading="loading">
                    <button class="button primary" v-if="!member.paid" @click="markPaid">
                        Markeer als betaald
                    </button>
                    <button class="button secundary" v-else @click="markNotPaid">
                        Toch niet betaald
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { STToolbar, LoadingButton } from "@stamhoofd/components";
import { Component, Prop,Vue } from "vue-property-decorator";
import { MemberWithRegistrations, PaymentStatus, PaymentPatch, EncryptedPaymentDetailed } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { OrganizationManager } from '../../../classes/OrganizationManager';
import { SessionManager } from '@stamhoofd/networking';
import { Decoder, ArrayDecoder } from '@simonbackx/simple-encoding';
import { MemberManager } from '../../../classes/MemberManager';

@Component({ 
    components: { 
        STToolbar,
        LoadingButton
    },
    filters: {
        price: Formatter.price
    }
})
export default class MemberViewPayments extends Vue {
    @Prop()
    member!: MemberWithRegistrations;
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
                for (const payment of this.payments) {
                    payment.status = PaymentStatus.Succeeded
                    // todo: improve this for related payments
                }
                MemberManager.callListeners("payment", this.member)
            } finally {
                this.loading = false
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
                    status: PaymentStatus.Pending
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
                for (const payment of this.payments) {
                    if (payment.status == PaymentStatus.Succeeded) {
                        payment.status = PaymentStatus.Pending
                    }
                    // todo: improve this for related payments
                }
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
