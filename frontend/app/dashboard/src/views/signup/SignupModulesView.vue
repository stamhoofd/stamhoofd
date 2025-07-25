<template>
    <form class="st-view" @submit.prevent="goNext">
        <STNavigationBar title="Functies uitproberen" :dismiss="canDismiss" :pop="canPop" />

        <main>
            <h1>
                Waarmee wil je beginnen?
            </h1>
            <p>
                Je kan later andere functies uitproberen via het instellingen menu.
            </p>

            <SmoothModuleSettingsBox />
        </main>
    </form>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, Checkbox,EmailInput, LoadingButton, STErrorsDefault, STInputBox, STNavigationBar, STToolbar } from "@stamhoofd/components"
import { Component, Mixins } from "vue-property-decorator";

import SmoothModuleSettingsBox from "../dashboard/settings/SmoothModuleSettingsBox.vue"

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
}
</script>