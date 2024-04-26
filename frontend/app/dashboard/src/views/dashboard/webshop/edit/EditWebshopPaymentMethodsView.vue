<template>
    <SaveView :title="viewTitle" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1>{{ viewTitle }}</h1>
        <p>Zoek je informatie over alle betaalmethodes, neem dan een kijkje op <a class="inline-link" :href="'https://'+$t('shared.domains.marketing')+'/docs/betaalmethodes-voor-webshops-instellen/'" target="_blank">deze pagina</a>.</p>

        <STErrorsDefault :error-box="errorBox" />

        <EditPaymentMethodsBox 
            type="webshop"
            :organization="organization" 
            :config="config"
            :private-config="privateConfig" 
            :validator="validator" 
            @patch:config="patchConfig($event)"
            @patch:privateConfig="patchPrivateConfig($event)" 
        />
    </SaveView>
</template>

<script lang="ts">
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { SaveView, STErrorsDefault, STInputBox } from "@stamhoofd/components";
import { SessionManager, UrlHelper } from '@stamhoofd/networking';
import { PaymentConfiguration, PrivatePaymentConfiguration, PrivateWebshop, WebshopMetaData, WebshopPrivateMetaData, WebshopTicketType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins } from "vue-property-decorator";

import EditPaymentMethodsBox from '../../../../components/EditPaymentMethodsBox.vue';
import EditWebshopMixin from './EditWebshopMixin';

@Component({
    components: {
        STInputBox,
        STErrorsDefault,
        EditPaymentMethodsBox,
        SaveView
    },
})
export default class EditWebshopPaymentMethodsView extends Mixins(EditWebshopMixin) {
    mounted() {
        UrlHelper.setUrl("/webshops/" + Formatter.slug(this.webshop.meta.name) + "/settings/payments")
    }

    get viewTitle() {
        return "Betaalmethodes"
    }

    get isAnyTicketType() {
        return (this.webshop.meta.ticketType !== WebshopTicketType.None)
    }

    get config() {
        return this.webshop.meta.paymentConfiguration
    }

    patchConfig(patch: AutoEncoderPatchType<PaymentConfiguration>) {
        this.addPatch(
            PrivateWebshop.patch({
                meta: WebshopMetaData.patch({
                    paymentConfiguration: patch
                })
            })
        )
    }

    get privateConfig() {
        return this.webshop.privateMeta.paymentConfiguration
    }

    patchPrivateConfig(patch: PrivatePaymentConfiguration) {
        this.addPatch(
            PrivateWebshop.patch({
                privateMeta: WebshopPrivateMetaData.patch({
                    paymentConfiguration: patch
                })
            })
        )
    }

    get organization() {
        return this.$context.organization!
    }

    
}
</script>
