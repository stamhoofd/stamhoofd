<template>
    <form id="signup-account-view" class="st-view" @submit.prevent="goNext">
        <STNavigationBar title="Maak jouw account">
            <BackButton slot="left" v-if="canPop" @click="pop"/>
            <button slot="right" class="button icon close gray" v-if="!canPop && canDismiss" @click="dismiss"/>
        </STNavigationBar>

        <main>
            <h1>
                Kies de functies die je wilt gebruiken
            </h1>
            <p>
                We rekenen nooit kosten aan zonder dit duidelijk te communiceren en hiervoor toestemming te vragen.
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
import { ObjectData } from '@simonbackx/simple-encoding';
import { isSimpleError, isSimpleErrors, SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { Server } from "@simonbackx/simple-networking";
import { ComponentWithProperties,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage,ErrorBox, LoadingButton, STErrorsDefault, STInputBox, STNavigationBar, STToolbar, BackButton, EmailInput, Validator, Checkbox } from "@stamhoofd/components"
import { KeyConstantsHelper, SensitivityLevel, Sodium } from "@stamhoofd/crypto"
import { NetworkManager, Session, SessionManager, Keychain, LoginHelper } from "@stamhoofd/networking"
import { CreateOrganization,KeychainItem,KeyConstants, NewUser, Organization,Token, Version } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "vue-property-decorator";
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