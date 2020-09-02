<template>
    <div class="st-view payconiq-button-view">
        <STNavigationBar title="Betaal met Payconiq by Bancontact">
            <button slot="right" class="button icon gray close" @click="dismiss" type="button"></button>
        </STNavigationBar>

        <main>
            <h1>Betaal met Payconiq by Bancontact</h1>

            <div class="payconiq-logo" />
        </main>

        <STToolbar>
            <a slot="right" :href="paymentUrl" class="button primary">
                <span class="icon external" /><span>Open de app</span>
            </a>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { STToolbar, LoadingButton, STNavigationBar, EmailInput, Validator, ErrorBox, Toast, STErrorsDefault } from "@stamhoofd/components"
import { Component, Mixins, Prop } from "vue-property-decorator";
import { SessionManager, Session } from '@stamhoofd/networking';
import { ForgotPasswordRequest } from '@stamhoofd/structures';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        EmailInput,
        LoadingButton,
        STErrorsDefault
    }
})
export default class PayconiqButtonView extends Mixins(NavigationMixin){
    @Prop({})
    paymentUrl: string;

}
</script>

<style lang="scss">
    .payconiq-button-view {
        --color-primary: #FF4785;

        .payconiq-logo {
            width: 150px;
            height: 150px;
            background: url(~@stamhoofd/assets/images/partners/payconiq/payconiq_by_Bancontact-logo-app-pos-shadow.png) no-repeat center center;
            background-size: contain;
        }

       
    }
</style>