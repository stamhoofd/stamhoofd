<template>
    <Steps :root="root" :total-steps="3" ref="steps">
        <template v-slot:left="slotProps">
            <template v-if="!slotProps.canPop">
                <img v-if="logoHorizontalSrc" :src="logoHorizontalSrc" :srcset="logoHorizontalSrcSet" class="organization-logo horizontal" :class="{ 'hide-smartphone': !!logoSrc }" @click="returnToSite">
                <img v-if="logoSrc" :src="logoSrc" :srcset="logoSrcSet" class="organization-logo" :class="{ 'only-smartphone': !!logoHorizontalSrc }" @click="returnToSite">
                <template v-if="!logoHorizontalSrc && !logoSrc">{{ organization.name }}</template>
            </template>
            <BackButton v-else @click="popNav" />
        </template>
        <template slot="right">
            <a class="button text limit-space" v-if="privacyUrl" :href="privacyUrl" target="_blank">
                <span class="icon privacy"/>
                <span>Privacy</span>
            </a>
            <button class="button text limit-space" @click="logout" v-if="isLoggedIn">
                <span class="icon logout"/>
                <span >Uitloggen</span>
            </button>
            <button class="button text limit-space" @click="returnToSite" v-if="organization.website">
                <span class="icon external"/>
                <span>Terug naar website</span>
            </button>
        </template>
    </Steps>
</template>


<script lang="ts">
import { ComponentWithProperties, NavigationController } from "@simonbackx/vue-app-navigation";
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Steps, BackButton } from "@stamhoofd/components"
import { Component, Mixins,Prop } from "vue-property-decorator";

import SignupGeneralView from '../signup/SignupGeneralView.vue';
import { OrganizationManager } from '../../classes/OrganizationManager';
import { SessionManager } from '@stamhoofd/networking';
import PaymentPendingView from '../overview/PaymentPendingView.vue';

@Component({
    components: {
        Steps,
        BackButton
    },
})
export default class RegistrationSteps extends Mixins(NavigationMixin){
    @Prop({ required: true })
    root!: ComponentWithProperties

    get privacyUrl() {
        if (OrganizationManager.organization!.meta.privacyPolicyUrl) {
            return OrganizationManager.organization!.meta.privacyPolicyUrl
        }
        if (OrganizationManager.organization!.meta.privacyPolicyFile) {
            return OrganizationManager.organization!.meta.privacyPolicyFile.getPublicPath()
        }
        return null
    }

    get organization() {
        return OrganizationManager.organization
    }

    get isLoggedIn() {
        return SessionManager.currentSession?.isComplete() ?? false
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

    logout() {
        if (SessionManager.currentSession?.isComplete() ?? false) {
            SessionManager.currentSession!.logout()
            return;
        }
    }
 
    returnToSite() {
        if (!this.organization.website || (!this.organization.website.startsWith("https://") && !this.organization.website.startsWith("http://"))) {
            return
        }
        window.location.href = this.organization.website
    }

    popNav() {
        (this.$refs.steps as any).navigationController.pop();
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