<template>
    <div class="boxed-view">
        <div class="st-view">
            <STNavigationBar v-if="isPopup" title="Overschrijven">
                <button slot="right" class="button icon gray close" @click="pop" />
            </STNavigationBar>

            <main>
                <h1>Bedrag overschrijven</h1>
                <p>Voer de onderstaande overschrijving uit. <span v-if="isBelgium" class="hide-smartphone">Je kan de QR-code scannen met deze bank apps: KBC, ING, Belfius of Argenta. Lukt het niet? Typ dan gewoon de gegevens over.</span></p>

                <div class="payment-split">
                    <div v-if="payment.price > 0" class="hide-smartphone">
                        <img v-if="QRCodeUrl" :src="QRCodeUrl">
                    </div>
                    <div>
                        <table class="payment-transfer-table">
                            <tbody>
                                <tr>
                                    <td>Bedrag</td>
                                    <td>{{ payment.price | price }}</td>
                                </tr>
                                <tr v-if="payment.price > 0">
                                    <td>Begunstigde</td>
                                    <td>{{ creditor }}</td>
                                </tr>
                                <tr v-if="payment.price > 0">
                                    <td>Bankrekeningnummer</td>
                                    <td>{{ iban }}</td>
                                </tr>
                                <tr v-if="payment.price > 0">
                                    <td v-if="isStructured">
                                        Gestructureerde mededeling
                                    </td>
                                    <td v-else>
                                        Mededeling
                                    </td>
                                    <td>{{ transferDescription }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <p v-if="payment.price > 0 && payment.status == 'Succeeded'" class="success-box">
                    We hebben de betaling ontvangen.
                </p>
                <p v-else-if="payment.price > 0" class="warning-box">
                    Voer de overschrijving meteen uit. Vermeld zeker “{{ transferDescription }}” in je overschrijving.
                </p>
            </main>

            <STToolbar v-if="!isPopup">
                <button v-if="false" slot="right" class="button secundary">
                    Afdrukken
                </button>
                <button slot="right" class="button primary" @click="goNext">
                    <span>Ik heb overgeschreven</span>
                    <span class="icon arrow-right" />
                </button>
            </STToolbar>
        </div>
    </div>
</template>

<script lang="ts">
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties,NavigationController,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox, ErrorBox,LoadingView, STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components"
import { Group, MemberWithRegistrations, Organization,Payment, PaymentDetailed, RegistrationWithMember, TransferDescriptionType, TransferSettings } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins,  Prop,Vue } from "vue-property-decorator";

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

    @Prop({ required: true }) 
    organization: Organization

    @Prop({ default: null }) 
    settings: TransferSettings | null

    @Prop({ default: null }) 
    additionalReference: string | null

    @Prop({ default: false })
    isPopup: boolean

    @Prop({ default: null })
    finishedHandler: ((payment: Payment | null) => void) | null

    QRCodeUrl: string | null = null

    isStepsPoppable = false

    mounted() {
        this.generateQRCode().catch(e => console.error(e))
    }

    isBelgium() {
        return this.organization.address.country == "BE"
    }

    get isStructured() {
        return this.settings?.type == TransferDescriptionType.Structured
    }

    get iban() {
        return this.settings?.iban ?? this.organization.meta.transferSettings.iban ?? "";
    }

    get creditor() {
        return this.settings?.creditor ?? this.organization.name
    }

    get transferDescription() {
        if (this.additionalReference && this.settings?.type === TransferDescriptionType.Reference) {
            return this.payment.transferDescription + " " + this.additionalReference
        }
        return this.payment.transferDescription
    }

    async generateQRCode() {
        try {
            const QRCode = (await import(/* webpackChunkName: "QRCode" */ 'qrcode')).default

            const iban = this.iban
            const creditor = this.creditor

            let message: string
            if (this.isStructured) {
                message = "BCD\n001\n1\nSCT\n\n"+creditor+"\n"+iban+"\nEUR"+(this.payment.price/100)+"\n\n"+this.transferDescription+"\n\nBetalen";
            } else {
                message = "BCD\n001\n1\nSCT\n\n"+creditor+"\n"+iban+"\nEUR"+(this.payment.price/100)+"\n\n\n"+this.transferDescription+"\nBetalen";
            }

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
       
        if (this.finishedHandler) {
            this.finishedHandler(this.payment)
        }
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