<template>
    <Steps ref="steps" :root="root" :total-steps="3">
        <template #left="slotProps">
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
            <button v-if="isLoggedIn" class="button text limit-space" @click="logout">
                <span class="icon logout" />
                <span>Uitloggen</span>
            </button>
            <button v-if="organization.website" class="button text limit-space" @click="returnToSite">
                <span class="icon external" />
                <span>Terug naar website</span>
            </button>
        </template>
    </Steps>
</template>


<script lang="ts">
import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton,CenteredMessage,CenteredMessageView,Steps } from "@stamhoofd/components"
import { SessionManager } from '@stamhoofd/networking';
import { Component, Mixins,Prop } from "vue-property-decorator";

import { OrganizationManager } from '../../classes/OrganizationManager';

@Component({
    components: {
        Steps,
        BackButton
    },
    metaInfo () {
        return {
            title: "Inschrijven bij "+this.organization.name,
             meta: [{
                vmid: 'description',
                name: 'description',
                content: 'Schrijf je via deze pagina in bij '+this.organization.name
            }],
        }
    }
})
export default class RegistrationSteps extends Mixins(NavigationMixin){
    @Prop({ required: true })
    root!: ComponentWithProperties

    get privacyUrl() {
        if (OrganizationManager.organization.meta.privacyPolicyUrl) {
            return OrganizationManager.organization.meta.privacyPolicyUrl
        }
        if (OrganizationManager.organization.meta.privacyPolicyFile) {
            return OrganizationManager.organization.meta.privacyPolicyFile.getPublicPath()
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
        if (SessionManager.currentSession && SessionManager.currentSession.isComplete()) {
            SessionManager.currentSession.logout()
            return;
        }
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