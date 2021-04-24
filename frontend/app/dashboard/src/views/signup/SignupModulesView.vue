<template>
    <form id="signup-account-view" class="st-view" @submit.prevent="goNext">
        <STNavigationBar title="Maak jouw account">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <button v-if="!canPop && canDismiss" slot="right" class="button icon close gray" @click="dismiss" />
        </STNavigationBar>

        <main>
            <h1>
                Kies de functies die je wilt uitproberen
            </h1>
            <p>
                Test de functies eerst rustig uit voor je beslist om een pakket te kopen. We rekenen nooit kosten aan zonder dit duidelijk te communiceren en hiervoor toestemming te vragen. Je kan later de functies activeren door de pakketten aan te schaffen via 'instellingen'.
            </p>

            <ModuleSettingsBox />
        </main>

        <STToolbar>
            <template #left>
                Je kan later deze functies wijzigingen bij je instellingen
            </template>
            <template #right>
                <button class="button primary" @click="goNext">
                    Klaar
                </button>
            </template>
        </STToolbar>
    </form>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, Checkbox,EmailInput, LoadingButton, STErrorsDefault, STInputBox, STNavigationBar, STToolbar } from "@stamhoofd/components"
import { Component, Mixins } from "vue-property-decorator";

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