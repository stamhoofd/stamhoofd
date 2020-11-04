<template>
    <Steps ref="steps" :root="root" :total-steps="totalSteps">
        <template v-slot:left="slotProps">
            <template v-if="!slotProps.canPop">
                <img v-if="logoHorizontalSrc" :src="logoHorizontalSrc" :srcset="logoHorizontalSrcSet" class="organization-logo horizontal" :class="{ 'hide-smartphone': !!logoSrc }" @click="returnToSite">
                <img v-if="logoSrc" :src="logoSrc" :srcset="logoSrcSet" class="organization-logo" :class="{ 'only-smartphone': !!logoHorizontalSrc }" @click="returnToSite">
                <template v-if="!logoHorizontalSrc && !logoSrc">
                    {{ organization.name }}
                </template>
            </template>
            <BackButton v-else @click="popNav" />
        </template>
        <template slot="right">
            <a v-if="privacyUrl" class="button text limit-space" :href="privacyUrl" target="_blank">
                <span class="icon privacy" />
                <span>Privacy</span>
            </a>

            <button class="primary button" @click="openCart">
                <span class="icon basket" />
                <span>{{ cartCount == 0 ? 'Winkelmandje' : cartCount }}</span>
            </button>
        </template>
    </Steps>
</template>


<script lang="ts">
import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton,CenteredMessage,CenteredMessageView,Steps } from "@stamhoofd/components"
import { SessionManager } from '@stamhoofd/networking';
import { CheckoutMethodType } from '@stamhoofd/structures';
import { Component, Mixins,Prop } from "vue-property-decorator";

import { CheckoutManager } from '../classes/CheckoutManager';
import { WebshopManager } from '../classes/WebshopManager';
import CartView from './checkout/CartView.vue';

@Component({
    components: {
        Steps,
        BackButton
    },
})
export default class CheckoutSteps extends Mixins(NavigationMixin){
    @Prop({ required: true })
    root!: ComponentWithProperties

    CheckoutManager = CheckoutManager

    get cartCount() {
        return CheckoutManager.cart.count
    }

    get totalSteps() {
        if (this.CheckoutManager.checkout.checkoutMethod && this.CheckoutManager.checkout.checkoutMethod.type == CheckoutMethodType.Delivery) {
            return 4
        }
        return 3
    }

    get privacyUrl() {
        if (WebshopManager.organization.meta.privacyPolicyUrl) {
            return WebshopManager.organization.meta.privacyPolicyUrl
        }
        if (WebshopManager.organization.meta.privacyPolicyFile) {
            return WebshopManager.organization.meta.privacyPolicyFile.getPublicPath()
        }
        return null
    }

    get organization() {
        return WebshopManager.organization
    }

    get logoSrc() {
        if (!this.organization.meta.squareLogo) {
            return null
        }
        return this.organization.meta.squareLogo.getPathForSize(undefined, 44)
    }

    get logoSrcSet() {
        if (!this.organization.meta.squareLogo) {
            return null
        }
        return this.organization.meta.squareLogo.getPathForSize(undefined, 44) + " 1x, "+this.organization.meta.squareLogo.getPathForSize(undefined, 44*2)+" 2x, "+this.organization.meta.squareLogo.getPathForSize(undefined, 44*3)+" 3x"
    }

     get logoHorizontalSrc() {
        if (!this.organization.meta.horizontalLogo) {
            return null
        }
        return this.organization.meta.horizontalLogo.getPathForSize(undefined, 44)
    }

    get logoHorizontalSrcSet() {
        if (!this.organization.meta.horizontalLogo) {
            return null
        }
        return this.organization.meta.horizontalLogo.getPathForSize(undefined, 44) + " 1x, "+this.organization.meta.horizontalLogo.getPathForSize(undefined, 44*2)+" 2x, "+this.organization.meta.horizontalLogo.getPathForSize(undefined, 44*3)+" 3x"
    }

    returnToSite() {
        if (!this.organization.website || (!this.organization.website.startsWith("https://") && !this.organization.website.startsWith("http://"))) {
            return
        }
        window.location.href = this.organization.website
    }

    popNav() {
        (this.$refs.steps as any).navigationController.pop();
    }

    mounted() {
        CenteredMessage.addListener(this, (centeredMessage) => {
            this.present(new ComponentWithProperties(CenteredMessageView, { centeredMessage }).setDisplayStyle("overlay"))
        })
    }

    openCart() {
        this.present(new ComponentWithProperties(CartView, {}).setDisplayStyle("popup"))
    }

    beforeDestroy() {
        CenteredMessage.removeListener(this)
    }
}
</script>

<style lang="scss">
    .organization-logo {
        max-height: 44px;
        max-width: 44px;
        cursor: pointer;
        touch-action: manipulation;

        &.horizontal {
            max-width: 30vw
        }
    }
</style>