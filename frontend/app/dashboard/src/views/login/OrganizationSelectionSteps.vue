<template>
    <Steps :root="root">
        <template slot="right">
            <button class="button primary" @click="gotoSignup">
                Aansluiten
            </button>
        </template>
    </Steps>
</template>


<script lang="ts">
import { ComponentWithProperties, NavigationController } from "@simonbackx/vue-app-navigation";
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { PromiseView } from '@stamhoofd/components';
import Steps from "@stamhoofd/components/src/steps/Steps.vue"
import { Component, Mixins,Prop } from "vue-property-decorator";

function asyncComponent(component: () => Promise<any>, properties = {}) {
    return new ComponentWithProperties(PromiseView, {
        promise: async function() {
            const c = (await component()).default
            return new ComponentWithProperties(c, properties)
        }
    })
}

@Component({
    components: {
        Steps
    },
})
export default class OrganizationSelectionSteps extends Mixins(NavigationMixin){
    @Prop({ required: true })
    root!: ComponentWithProperties

    gotoSignup() {
        this.present(
            new ComponentWithProperties(NavigationController, {
                root: asyncComponent(() => import(/* webpackChunkName: "SignupGeneralView" */ '../signup/SignupGeneralView.vue'), {})
            }).setDisplayStyle("popup")
        )
        plausible('openSignup');
    }
}
</script>