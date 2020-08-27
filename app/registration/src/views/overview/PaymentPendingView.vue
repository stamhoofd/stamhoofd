<template>
    <div class="boxed-view">
        <div class="st-view">
            <main v-if="!payment || payment.status == 'Pending'">
                <h1>Wachten op betaalbevestiging...</h1>
                <p>We wachten op de betaalbevestiging van de bank. Dit duurt hooguit 5 minuten, daarna leggen we de inschrijving vast.</p>

                <Spinner />
            </main>

            <main v-else>
                <h1>Betaling mislukt</h1>
                <p>De betaling werd geannuleerd of door de bank geweigerd.</p>
            </main>
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Mixins,  Prop } from "vue-property-decorator";
import { ComponentWithProperties,NavigationController,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { STNavigationBar, STToolbar, STList, STListItem, LoadingView, Spinner, ErrorBox } from "@stamhoofd/components"
import MemberGeneralView from '../registration/MemberGeneralView.vue';
import { MemberManager } from '../../classes/MemberManager';
import { MemberWithRegistrations, Group, PaymentDetailed, RegistrationWithMember, EncryptedPaymentDetailed, PaymentStatus } from '@stamhoofd/structures';
import { OrganizationManager } from '../../classes/OrganizationManager';
import MemberGroupView from '../registration/MemberGroupView.vue';
import { SimpleError } from '@simonbackx/simple-errors';
import OverviewView from './OverviewView.vue';
import { SessionManager } from '@stamhoofd/networking';
import { Decoder } from '@simonbackx/simple-encoding';
import RegistrationSuccessView from './RegistrationSuccessView.vue';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        LoadingView,
        Spinner
    }
})
export default class PaymentPendingView extends Mixins(NavigationMixin){
    payment: EncryptedPaymentDetailed | null = null

    MemberManager = MemberManager
    step = 4
    isStepsPoppable = false

    pollCount = 0
    timer: any = null

    mounted() {
        this.timer = setTimeout(this.poll.bind(this), 3000 + Math.min(10*1000, this.pollCount*1000));
    }

    poll() {
        this.timer = null;
        const paymentId = new URL(window.location.href).searchParams.get("id");
        SessionManager.currentSession!.authenticatedServer
            .request({
                method: "POST",
                path: "/payments/" +paymentId,
                decoder: EncryptedPaymentDetailed as Decoder<EncryptedPaymentDetailed>,
            }).then(response => {
                const payment = response.data
                if (payment.status == PaymentStatus.Succeeded) {
                    MemberManager.getRegistrationsWithMember(payment.registrations).then( (registrations) => {
                        const navigation = this.navigationController
                        navigation?.push(new ComponentWithProperties(RegistrationSuccessView, { registrations }), false, 1, true)
                    }).catch(e => {
                        console.error(e)
                    })  
                } else {
                    this.payment = payment
                }
            }).catch(e => {
                // too: handle this
                console.error(e)
            }).finally(() => {
                this.pollCount++;
                if (this.payment && (this.payment.status == PaymentStatus.Succeeded || this.payment.status == PaymentStatus.Failed)) {
                    return;
                }
                this.timer = setTimeout(this.poll.bind(this), 3000 + Math.min(10*1000, this.pollCount*1000));
            });
    }

    beforeDestroy() {
        if (this.timer) {
            clearTimeout(this.timer)
            this.timer = null
        }
    }

}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;


</style>