<template>
    <Steps :root="root" :total-steps="3">
        <template v-slot:left="slotProps">
            <template v-if="!slotProps.canPop">
                <img v-if="logoHorizontalSrc" :src="logoHorizontalSrc" :srcset="logoHorizontalSrcSet" class="organization-logo horizontal" :class="{ 'hide-smartphone': !!logoSrc }">
                <img v-if="logoSrc" :src="logoSrc" :srcset="logoSrcSet" class="organization-logo" :class="{ 'only-smartphone': !!logoHorizontalSrc }">
                <template v-if="!logoHorizontalSrc && !logoSrc">{{ organization.name }}</template>
            </template>
            <BackButton v-else @click="popNav" />
        </template>
        <template slot="right">
            <button class="button text limit-space" @click="returnToSite" v-if="organization.website">
                <span class="icon logout"/>
                <span v-if="isLoggedIn">Uitloggen</span>
                <span v-else>Terug naar website</span>
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

@Component({
    components: {
        Steps,
        BackButton
    },
})
export default class RegistrationSteps extends Mixins(NavigationMixin){
    @Prop({ required: true })
    root!: ComponentWithProperties

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
 
    returnToSite() {
        if (SessionManager.currentSession?.isComplete() ?? false) {
            SessionManager.currentSession!.logout()
            return;
        }
        if (!this.organization.website || (!this.organization.website.startsWith("https://") && !this.organization.website.startsWith("http://"))) {
            return
        }
        window.location.href = this.organization.website
    }

    popNav() {
        (this.root.componentInstance() as any).navigationController.pop();
    }
}
</script>

<style lang="scss">
    .organization-logo {
        max-height: 44px;
        max-width: 44px;

        &.horizontal {
            max-width: 30vw
        }
    }
</style>