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
                    <div class="hide-smartphone">
                        <img v-if="QRCodeUrl" :src="QRCodeUrl" />
                    </div>
                    <div>
                        <table class="payment-transfer-table">
                            <tbody>
                                <tr>
                                    <td>Bedrag</td>
                                    <td>{{ payment.price | price }}</td>
                                </tr>
                                <tr>
                                    <td>Bankrekening</td>
                                    <td>todo</td>
                                </tr>
                                <tr>
                                    <td>BIC</td>
                                    <td>todo</td>
                                </tr>
                                <tr>
                                    <td>Gestructureerde mededeling</td>
                                    <td>{{ payment.transferDescription }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    
                </div>


                <p class="warning-box">Vermeld zeker “{{ payment.transferDescription }}” in je overschrijving.</p>
            </main>

            <STToolbar>
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
import { DecryptedMember, Group, Payment, PaymentDetailed, RegistrationWithMember } from '@stamhoofd/structures';
import { OrganizationManager } from '../../../../dashboard/src/classes/OrganizationManager';
import MemberGroupView from '../registration/MemberGroupView.vue';
import { SimpleError } from '@simonbackx/simple-errors';
import RegistrationSuccessView from './RegistrationSuccessView.vue';
import { Formatter } from '@stamhoofd/utility';
import QRCode from 'qrcode'

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
    QRCodeUrl: string | null = null

    step = 3

    get paymentDetailed() {
        if (this.payment instanceof PaymentDetailed) {
            return this.payment
        }

        const detailed = PaymentDetailed.create(Object.assign({
            registrations: []
        }, this.payment))

        if (!MemberManager.members) {
            return detailed
        }
        
        const groups = OrganizationManager.organization.groups
        for (const member of MemberManager.members) {
            for (const registration of member.registrations) {
                if (registration.payment.id != this.payment.id) {
                    continue;
                }

                const group = groups.find(g => g.id == registration.groupId)
                if (!group) {
                    continue;
                }
                const reg = RegistrationWithMember.create(
                    Object.assign({
                        member,
                        group
                    }, registration)
                );
                detailed.registrations.push(reg)
            }
        }
        return detailed
    }

    mounted() {
        this.generateQRCode()
    }

    generateQRCode() {
        const iban = "AT611904300234573201";
        const bic = "ABCDATWW"
        const creditor = OrganizationManager.organization.name
        const message = "BCD\n001\n1\nSCT\n"+bic+"\n"+creditor+"\n"+iban+"\nEUR"+(this.payment.price/100)+"\n\n"+this.payment.transferDescription+"\n\nLidgeld betalen";

        QRCode.toDataURL(message)
            .then(url => {
                console.log(url)
                this.QRCodeUrl = url
            })
            .catch(err => {
                console.error(err)
            })
    }

    goNext() {
        if (this.isPopup) {
            this.dismiss()
            return;
        }
       
        this.show(new ComponentWithProperties(RegistrationSuccessView, {

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