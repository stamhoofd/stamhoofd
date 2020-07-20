<template>
    <Steps :root="root" :total-steps="3">
        <template v-slot:left="slotProps">
            <template v-if="!slotProps.canPop">
                {{ organization.name }}
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