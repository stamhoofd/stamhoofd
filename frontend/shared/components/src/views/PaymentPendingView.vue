<template>
    <div class="st-view">
        <STNavigationBar title="Betaling" />

        <main v-if="!payment || payment.status != 'Failed'">
            <h1>Wachten op betaalbevestiging...</h1>
            <p>We wachten op de betaalbevestiging van de bank. Verlaat deze pagina niet. Dit duurt hooguit 5 minuten.</p>

            <Spinner />
        </main>

        <main v-else>
            <h1>Betaling mislukt</h1>
            <p>De betaling werd geannuleerd of door de bank geweigerd.</p>
        </main>

        <STToolbar v-if="payment && (payment.status == 'Failed' || payment.method == 'Payconiq')">
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
import { Server } from '@simonbackx/simple-networking';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { LoadingButton,LoadingView, Spinner, STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components"
import { Payment, PaymentStatus } from '@stamhoofd/structures';
import { Component, Mixins,  Prop } from "vue-property-decorator";

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
export default class PaymentPendingView extends Mixins(NavigationMixin){
    @Prop({ required: true })
        paymentId: string;

    /**
     * Try to cancel the payment if still possible
     */
    @Prop({ default: false })
        cancel: boolean;

    @Prop({ required: true })
        server: Server

    payment: Payment | null = null
    loading = false

    //step = 4 // TODO?
    isStepsPoppable = false

    pollCount = 0
    timer: any = null
    didFinish = false

    @Prop({ required: true })
        finishedHandler: (payment: Payment | null) => void

    mounted() {
        this.timer = setTimeout(this.poll.bind(this), 200);
    }

    retry() {
        if (confirm("Probeer alleen opnieuw als je zeker bent dat je niet hebt betaald! Anders moet je gewoon even wachten.")) {
            const navigation = this.navigationController

            if (navigation!.components.length > 1) {
                this.pop();
            } else {
                this.finishedHandler.call(this, this.payment)
            }
        }
        
    }

    poll() {
        this.timer = null;

        if (this.didFinish) {
            return;
        }
        const paymentId = this.paymentId
        this.server
            .request({
                method: "POST",
                path: "/payments/" +paymentId,
                decoder: Payment as Decoder<Payment>,
                query: {
                    cancel: this.cancel
                }
            }).then(response => {
                const payment = response.data
                this.payment = payment

                this.pollCount++;

                if (this.didFinish) {
                    return;
                }
                if (this.payment && (this.payment.status == PaymentStatus.Succeeded || this.payment.status == PaymentStatus.Failed)) {
                    this.didFinish = true
                    this.finishedHandler.call(this, this.payment);
                    return;
                }
                this.timer = setTimeout(this.poll.bind(this), 3000 + Math.min(10*1000, this.pollCount*1000));
            }).catch(e => {
                if (this.didFinish) {
                    return;
                }
                this.didFinish = true
                this.finishedHandler.call(this, this.payment);
            })
    }

    beforeDestroy() {
        if (this.timer) {
            clearTimeout(this.timer)
            this.timer = null
        }
    }

}
</script>
