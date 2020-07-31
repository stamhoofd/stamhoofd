<template>
    <div class="boxed-view">
        <div class="st-view">
            <STNavigationBar title="Overschrijven" v-if="isPopup">
                <button slot="right" class="button icon gray close" @click="pop"></button>
            </STNavigationBar>

            <main>
                <h1>Lidgeld overschrijven</h1>
                <p>Voer de onderstaande overschrijving uit. Vermeld zeker de mededeling in je overschrijving! <span class="hide-smartphone">Je kan de QR-code scannen met de meeste bank apps.</span></p>

                <div class="payment-split">
                    <div class="hide-smartphone" v-if="payment.price > 0">
                        <img v-if="QRCodeUrl" :src="QRCodeUrl" />
                    </div>
                    <div>
                        <table class="payment-transfer-table">
                            <tbody>
                                <tr>
                                    <td>Bedrag</td>
                                    <td>{{ payment.price | price }}</td>
                                </tr>
                                <tr v-if="payment.price > 0">
                                    <td>Bankrekening</td>
                                    <td>{{ organization.meta.iban }}</td>
                                </tr>
                                <tr v-if="payment.price > 0">
                                    <td>Gestructureerde mededeling</td>
                                    <td>{{ payment.transferDescription }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <p class="warning-box" v-if="payment.price > 0">Voer de overschrijving meteen uit. Vermeld zeker “{{ payment.transferDescription }}” in je overschrijving.</p>
            </main>

            <STToolbar v-if="!isPopup">
                <button slot="right" class="button secundary" v-if="false">
                    Afdrukken
                </button>
                <button slot="right" class="button primary" @click="goNext">
                    <span>Ik heb overgeschreven</span>
                    <span class="icon arrow-right"/>
                </button>
            </STToolbar>
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Mixins,  Prop } from "vue-property-decorator";
import { ComponentWithProperties,NavigationController,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { STNavigationBar, STToolbar, STList, STListItem, LoadingView, Checkbox, ErrorBox } from "@stamhoofd/components"
import MemberGeneralView from '../registration/MemberGeneralView.vue';
import { MemberManager } from '../../classes/MemberManager';
import { MemberWithRegistrations, Group, Payment, PaymentDetailed, RegistrationWithMember } from '@stamhoofd/structures';
import { OrganizationManager } from '../../classes/OrganizationManager';
import MemberGroupView from '../registration/MemberGroupView.vue';
import { SimpleError } from '@simonbackx/simple-errors';
import RegistrationSuccessView from './RegistrationSuccessView.vue';
import { Formatter } from '@stamhoofd/utility';

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
export default class TransferPaymentView extends Mixins(NavigationMixin){
    @Prop({ required: true })
    payment: Payment

    @Prop({ default: false })
    isPopup: boolean

    MemberManager = MemberManager
    organization = OrganizationManager.organization
    QRCodeUrl: string | null = null

    step = 3
    isStepsPoppable = false

    get paymentDetailed() {
        return MemberManager.getPaymentDetailed(this.payment)
    }

    mounted() {
        this.generateQRCode()
    }

    async generateQRCode() {
        try {
            const QRCode = (await import(/* webpackChunkName: "QRCode" */ 'qrcode')).default

            const iban = this.organization.meta.iban ?? "";
            const creditor = OrganizationManager.organization.name
            const message = "BCD\n001\n1\nSCT\n\n"+creditor+"\n"+iban+"\nEUR"+(this.payment.price/100)+"\n\n"+this.payment.transferDescription+"\n\nLidgeld betalen";

            this.QRCodeUrl = await QRCode.toDataURL(message)
        } catch (e) {
            console.error(e)
            return;
        }
    }

    goNext() {
        if (this.isPopup) {
            this.dismiss({ force: true })
            return;
        }
       
        this.show(new ComponentWithProperties(RegistrationSuccessView, {
            payment: this.paymentDetailed
        }))
    }

}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.payment-split {
    display: grid;
    grid-template-columns: 200px minmax(0px, 1fr);
    grid-template-rows: auto;
    column-gap: 10px;
    align-items: center;

    @media (max-width: 500px) {
        display: block;
    }

    > div:last-child {
        padding: 15px 0;
    }
}
.payment-transfer-table {
    td {
        vertical-align: middle;
    }
    td:first-child {
        @extend .style-title-small;
        padding: 7px 15px 7px 0;
    }

    td:last-child {
         @extend .style-description;
    }
}

</style>