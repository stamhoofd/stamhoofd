<template>
    <form class="st-view" @submit.prevent="goNext">
        <STNavigationBar title="Functies uitproberen" :dismiss="canDismiss" :pop="canPop" />

        <main>
            <h1>
                Kies de functies die je wilt uitproberen
            </h1>
            <p>
                Test de functies eerst rustig uit voor je beslist om een pakket te kopen. Je hoeft geen betaalgegevens in te geven.
            </p>

            <ModuleSettingsBox />
        </main>

        <STToolbar>
            <template #left>
                Je kan later deze functies wijzigingen via het instellingen menu.
            </template>
            <template #right>
                <button class="button primary" type="submit">
                    Aan de slag
                </button>
            </template>
        </STToolbar>
    </form>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, Checkbox,EmailInput, LoadingButton, STErrorsDefault, STInputBox, STNavigationBar, STToolbar } from "@stamhoofd/components"
import { Component, Mixins } from "@simonbackx/vue-app-navigation/classes";

import ModuleSettingsBox from "../dashboard/settings/ModuleSettingsBox.vue"

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
        ModuleSettingsBox
    }
})
export default class SignupModulesView extends Mixins(NavigationMixin) {
  
    goNext() {
        this.dismiss({ force: true })
    }
}
</script>