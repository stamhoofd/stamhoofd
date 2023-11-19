<template>
    <div class="st-view">
        <STNavigationBar title="Betaling" />
        <main v-if="!payment || payment.status != 'Failed'">
            <h1>Wachten op betaalbevestiging...</h1>
            <p>We wachten op de betaalbevestiging van de bank. Dit duurt hooguit 5 minuten.</p>

            <Spinner />
        </main>

        <main v-else>
            <h1>Betaling mislukt</h1>
            <p>De betaling werd geannuleerd of door de bank geweigerd.</p>
        </main>

        <STToolbar v-if="payment && (payment.status == 'Failed')">
            <LoadingButton slot="right" :loading="loading">
                <button class="button primary" type="button" @click="retry">
                    <span>Opnieuw proberen</span>
                </button>
            </LoadingButton>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { Decoder } from '@simonbackx/simple-encoding';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, LoadingButton, LoadingView, Spinner, STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components";
import { SessionManager, UrlHelper } from '@stamhoofd/networking';
import { PaymentMethod, PaymentStatus, STInvoice } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "vue-property-decorator";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        LoadingView,
        LoadingButton,
        Spinner
    }
})
export default class InvoicePaymentStatusView extends Mixins(NavigationMixin){
    @Prop({ required: true })
        paymentId: string;

    invoice: STInvoice | null = null
    loading = false

    pollCount = 0
    timer: any = null

    get payment() {
        return this.invoice?.payment ?? null
    }

    mounted() {
        UrlHelper.setUrl("/settings/billing/payment?id="+encodeURIComponent(this.paymentId))
        this.timer = setTimeout(this.poll.bind(this), 3000 + Math.min(10*1000, this.pollCount*1000));
    }

    retry() {
        this.dismiss({ force: true })
    }

    onSuccess() {
        // Reload organization
        SessionManager.currentSession?.fetchOrganization().catch(e => console.error)

        new CenteredMessage("Betaling gelukt!", "Bedankt voor jouw betaling. Het pakket wordt meteen geactiveerd").addCloseButton().show()
        this.dismiss({ force: true })
    }

    onTransfer() {
        // Reload organization
        SessionManager.currentSession?.fetchOrganization().catch(e => console.error)

        new CenteredMessage("Betalen via overschrijving", "Jouw pakket is tijdelijk geactiveerd. Zorg zeker voor een snelle afhandeling van de betaling. Als we jouw overschrijving niet ontvangen zal het pakket terug gedeactiveerd worden. Eventuele latere betalingen worden dan automatisch terugbetaald.").addCloseButton().show()
        this.dismiss({ force: true })
    }

    poll() {
        this.timer = null;
        const paymentId = this.paymentId;
        SessionManager.currentSession!.authenticatedServer
            .request({
                method: "POST",
                path: "/billing/payments/" +paymentId,
                decoder: STInvoice as Decoder<STInvoice>,
            }).then(response => {
                const invoice = response.data
                this.invoice = invoice

                this.pollCount++;

                if (this.payment && this.payment.status == PaymentStatus.Succeeded) {
                    this.onSuccess()
                    return;
                }

                if (this.payment && this.payment.method == PaymentMethod.Transfer) {
                    this.onTransfer()
                    return;
                }

                if (this.payment && this.payment.status == PaymentStatus.Failed) {
                    return;
                }
                this.timer = setTimeout(this.poll.bind(this), 3000 + Math.min(10*1000, this.pollCount*1000));
            }).catch(e => {
                CenteredMessage.fromError(e).show()
            })
    }

    beforeDestroy() {
        if (this.timer) {
            clearTimeout(this.timer)
            this.timer = null
        }
    }

    shouldNavigateAway() {
        return this.payment && this.payment.status === 'Failed'
    }

}
</script>