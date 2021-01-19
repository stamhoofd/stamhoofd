<template>
    <form class="auto st-view login-view" @submit.prevent="submit">
        <STNavigationBar title="Inloggen">
            <button slot="right" type="button" class="button icon gray close" @click="dismiss" />
        </STNavigationBar>
        <main>
            <h1>Wachtwoord wijzigen</h1>

            <STErrorsDefault :error-box="errorBox" />

            <STInputBox title="Kies een wachtwoord">
                <input v-model="password" class="input" placeholder="Kies een nieuw wachtwoord" autocomplete="new-password" type="password">
            </STInputBox>

            <STInputBox title="Herhaal wachtwoord">
                <input v-model="passwordRepeat" class="input" placeholder="Herhaal nieuw wachtwoord" autocomplete="new-password" type="password">
            </STInputBox>

            <PasswordStrength v-model="password" />
        </main>

        <STFloatingFooter>
            <LoadingButton :loading="loading">
                <button class="button primary full">
                    <span class="lock icon" />
                    <span>Wijzigen</span>
                </button>
            </LoadingButton>
        </STFloatingFooter>
    </form>
</template>

<script lang="ts">
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties,HistoryManager,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, ErrorBox, LoadingButton, STErrorsDefault, STFloatingFooter, STInputBox, STNavigationBar, Toast,Validator, PasswordStrength } from "@stamhoofd/components"
import { LoginHelper, SessionManager } from '@stamhoofd/networking';
import { Component, Mixins } from "vue-property-decorator";

@Component({
    components: {
        STNavigationBar,
        STFloatingFooter,
        STInputBox,
        LoadingButton,
        STErrorsDefault,
        PasswordStrength
    }
})
export default class ChangePasswordView extends Mixins(NavigationMixin){
    loading = false

    password = ""
    passwordRepeat = ""

    errorBox: ErrorBox | null = null
    validator = new Validator()

    async submit() {
        if (this.loading) {
            return
        }

        // Request the key constants

        if (this.password != this.passwordRepeat) {
            this.errorBox = new ErrorBox(new SimpleError({
                code: "",
                message: "De ingevoerde wachtwoorden komen niet overeen"
            }))
            return;
        }

        if (this.password.length < 8) {
            this.errorBox = new ErrorBox(new SimpleError({
                code: "",
                message: "Jouw wachtwoord moet uit minstens 8 karakters bestaan."
            }))
            return;
        }
        this.loading = true


        const component = new CenteredMessage("Wachtwoord wijzigen...", "We maken gebruik van lange wiskundige berekeningen die alle gegevens sterk beveiligen door middel van end-to-end encryptie. Dit duurt maar heel even.", "loading").show()

        try {
            await LoginHelper.changePassword(SessionManager.currentSession!, this.password)
            this.dismiss({ force: true });
            HistoryManager.setUrl("/")
            new Toast('Jouw nieuwe wachtwoord is opgeslagen', "success").show()
        } catch (e) {
            this.loading = false;
            this.errorBox = new ErrorBox(e)
            return;
        } finally {
            component.hide()
        }
    }
}
</script>
