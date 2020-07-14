<template>
    <Steps :root="root">
        <template slot="left">
            {{ organization.name }}
        </template>
        <template slot="right">
            <button class="button icon left logout gray" @click="returnToSite" v-if="organization.website">
                Terug naar website
            </button>
        </template>
    </Steps>
</template>


<script lang="ts">
import { ComponentWithProperties, NavigationController } from "@simonbackx/vue-app-navigation";
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import Steps from "@stamhoofd/components/src/steps/Steps.vue"
import { Component, Mixins,Prop } from "vue-property-decorator";

import SignupGeneralView from '../signup/SignupGeneralView.vue';
import { OrganizationManager } from '../../classes/OrganizationManager';

@Component({
    components: {
        Steps
    },
})
export default class RegistrationSteps extends Mixins(NavigationMixin){
    @Prop({ required: true })
    root!: ComponentWithProperties

    get organization() {
        return OrganizationManager.organization
    }
 
    returnToSite() {
        if (!this.organization.website || (!this.organization.website.startsWith("https://") && !this.organization.website.startsWith("http://"))) {
            return
        }
        window.location.href = this.organization.website
    }
}
</script>