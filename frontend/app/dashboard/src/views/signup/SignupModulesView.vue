<template>
    <form class="st-view" @submit.prevent="goNext">
        <STNavigationBar title="Waarmee wil je beginnen?" :dismiss="canDismiss" :pop="canPop" />

        <main>
            <h1>
                Waarmee wil je beginnen?
            </h1>
            <SmoothModuleSettingsBox />
        </main>
    </form>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, Checkbox,EmailInput, LoadingButton, STErrorsDefault, STInputBox, STNavigationBar, STToolbar } from "@stamhoofd/components"
import { Component, Mixins } from "vue-property-decorator";

import SmoothModuleSettingsBox from "../dashboard/settings/SmoothModuleSettingsBox.vue"
import { usePostHog } from './usePostHog';

@Component({
    components: {
        STToolbar,
        STNavigationBar,
        STErrorsDefault,
        STInputBox,
        LoadingButton,
        BackButton,
        EmailInput,
        Checkbox,
        SmoothModuleSettingsBox
    }
})
export default class SignupModulesView extends Mixins(NavigationMixin) {
    goNext() {
        this.dismiss({ force: true })
    }

    mounted() {
        usePostHog();
    }
}
</script>