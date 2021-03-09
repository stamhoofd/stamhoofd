<template>
    <div class="st-view boxed">
        <STNavigationBar :large="true" title="Overschrijven">
            <button v-if="isPopup" slot="right" class="button icon gray close" @click="pop" />
        </STNavigationBar>

        <div class="box">
            <main>
                <h1 v-if="created && type == 'order'">
                    Bestelling geplaatst!
                </h1>
                <h1 v-else-if="created">
                    Gelukt! Schrijf nu het bedrag over
                </h1>
                <h1 v-else>
                    Bedrag overschrijven
                </h1>
                <p v-if="payment.price > 0 && payment.status != 'Succeeded' && created">
                    Voer de overschrijving meteen uit. Vermeld zeker “{{ transferDescription }}” in je overschrijving.
                </p>
                <p v-if="payment.price > 0 && payment.status != 'Succeeded' && !created">
                    We kijken de betaalstatus van jouw overschrijving manueel na. Het kan dus even duren voor je hier ziet staan dat we de betaling hebben ontvangen. Vermeld zeker “{{ transferDescription }}” in je overschrijving.
                </p>

                <div class="payment-split">
                    <div v-if="payment.price > 0" class="hide-smartphone rectangle">
                        <div class="rectangle-top">
                            Scan met deze apps
                        </div>
                        <div class="rectangle-bottom">
                            <img v-if="isBelgium" src="@stamhoofd/assets/images/partners/scan-apps-belgium.svg">
                            <img v-else src="@stamhoofd/assets/images/partners/scan-apps-nl.svg">
                        </div>
                        <img v-if="QRCodeUrl" :src="QRCodeUrl">
                    </div>
                    <div class="rectangle">
                        <div v-if="payment.price > 0" class="rectangle-top hide-smartphone">
                            Of typ het over
                        </div>
                        <table class="payment-transfer-table rectangle">
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
                                    <td>Rekeningnummer</td>
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
                <template v-else-if="payment.price > 0 && created">
                    <p v-if="isBelgium" class="hide-smartphone warning-box">
                        Typ de gegevens over als de QR-code niet lukt, dat is net hetzelfde. Dit is geen gewone Bancontact/Payconiq QR-code. Ze voert gewoon alle nodige gegevens in jouw bankapp in zodat je de overschrijving sneller kan uitvoeren. De website weet dus niet wanneer je al betaald hebt tot we dit zelf hebben aangeduid. Je kan enkel scannen met deze apps: KBC, ING, Belfius of Argenta, niet met je ingebouwde QR-scanner en ook niet met Payconiq/Bancontact.
                    </p>     
                    <p v-else class="hide-smartphone warning-box">
                        Typ de gegevens over als de QR-code niet lukt, dat is net hetzelfde. Dit is geen gewone iDEAL QR-code. Ze voert gewoon alle nodige gegevens in jouw bankapp in zodat je de overschrijving sneller kan uitvoeren. De website weet dus niet wanneer je al betaald hebt tot we dit zelf hebben aangeduid. Je kan enkel scannen met deze apps: ING of Bunq; niet met je ingebouwde QR-scanner of andere apps.
                    </p>     
                    <p class="only-smartphone warning-box">
                        Voer de overschrijving meteen uit. Vermeld zeker “{{ transferDescription }}” in je overschrijving.
                    </p>              
                </template>
            </main>

            <STToolbar v-if="!isPopup">
                <button v-if="payment.price > 0 && payment.status != 'Succeeded'" slot="right" class="button secundary hide-smartphone" @click="helpMe">
                    <span class="icon help" />
                    <span>Het lukt niet</span>
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
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton,Checkbox,LoadingView, STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components"
import { Organization,Payment, TransferDescriptionType, TransferSettings } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins,  Prop } from "vue-property-decorator";

import { CenteredMessage } from '../overlays/CenteredMessage';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        LoadingView,
        Checkbox,
        BackButton
    },
    filters: {
        price: Formatter.price
    }
})
export default class TransferPaymentView extends Mixins(NavigationMixin){

    @Prop({ required: true })
    payment: Payment

    @Prop({ default: false })
    created: boolean

    @Prop({ required: true })
    type: "registration" | "order"

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
        this.setLeave()
    }

    beforeDestroy() {
        console.log("destroy")
        window.removeEventListener("beforeunload", this.preventLeave);
    }

    setLeave() {
        if (!this.created) {
            return;
        }
        if (this.type === "order") {
            window.addEventListener("beforeunload", this.preventLeave);
        }
    }

    preventLeave(event) {
        // Cancel the event
        event.preventDefault(); // If you prevent default behavior in Mozilla Firefox prompt will always be shown
        // Chrome requires returnValue to be set
        event.returnValue = 'Jouw bestelling is al geplaatst! Als je je bestelling gaat aanpassen zal je een tweede bestelling plaatsen!';

        // This message is not visible on most browsers
        return "Jouw bestelling is al geplaatst! Als je je bestelling gaat aanpassen zal je een tweede bestelling plaatsen!"
    }

    get isBelgium() {
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

    helpMe() {
        if (this.type === "order") {
            new CenteredMessage("Het lukt niet", "Herlaad de pagina zeker niet, en probeer vooral niet opnieuw, want jouw bestelling is al geplaatst. Neem je bankapp en voer de overschrijving uit of ga naar de bank om de bovenstaande overschrijving uit te voeren.").addCloseButton().show()
        } else {
            new CenteredMessage("Het lukt niet", "Herlaad de pagina zeker niet, en probeer vooral niet opnieuw, want jouw inschrijving is al in orde. Neem je bankapp en voer de overschrijving uit of ga naar de bank om de bovenstaande overschrijving uit te voeren.").addCloseButton().show()
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
    display: flex;
    flex-direction: row;
    padding: 15px 0;

    @media (max-width: 800px) {
        flex-direction: column;
    }

    > .rectangle {
        border: 2px solid $color-border;
        border-radius: 8px;
        padding: 20px;
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;

        >.rectangle-top {
            position: absolute;
            top: 0;
            transform: translate(-50%, -50%);
            background: white;
            text-align: center;
            left: 50%;
            max-width: 90%;
            padding: 0 15px;
            box-sizing: border-box;
            line-height: 1.4;

            @extend .style-interactive-small;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
        }

        >.rectangle-bottom {
            position: absolute;
            bottom: 0;
            transform: translate(-50%, 50%);
            background: white;
            text-align: center;
            left: 50%;
            max-width: 90%;
            padding: 0 15px;
            box-sizing: border-box;

            @extend .style-interactive-small;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
        }

        &:first-child {
            margin-right: 15px;;
            padding: 15px 15px;

            @media (max-width: 800px) {
                margin-right: 0px;
                margin-bottom: 30px;
            }
        }
    }
}
.payment-transfer-table {
    td {
        vertical-align: baseline;
    }
    td:first-child {
        @extend .style-title-small;
        padding: 7px 15px 7px 0;

        @media (max-width: 400px) {
            font-size: 12px;
        }
    }

    td:last-child {
        @extend .style-description;

        @media (max-width: 400px) {
            font-size: 12px;
        }
    }
}

</style>