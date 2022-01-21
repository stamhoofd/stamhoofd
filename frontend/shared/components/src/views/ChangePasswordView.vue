<template>
    <SaveView class="auto" data-submit-last-field title="Wachtwoord wijzigen" save-icon="lock" @save="submit">
        <h1>Wachtwoord wijzigen</h1>

        <STErrorsDefault :error-box="errorBox" />

        <STInputBox title="Kies een wachtwoord">
            <input v-model="password" class="input" enterkeyhint="next" placeholder="Kies een nieuw wachtwoord" autocomplete="new-password" type="password" @input="password = $event.target.value" @change="password = $event.target.value">
        </STInputBox>

        <STInputBox title="Herhaal wachtwoord">
            <input v-model="passwordRepeat" enterkeyhint="go" class="input" placeholder="Herhaal nieuw wachtwoord" autocomplete="new-password" type="password" @input="passwordRepeat = $event.target.value" @change="passwordRepeat = $event.target.value">
        </STInputBox>

        <PasswordStrength v-model="password" />
    </SaveView>
</template>

<script lang="ts">
import { SimpleError } from '@simonbackx/simple-errors';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, ErrorBox, LoadingButton, PasswordStrength, SaveView,STErrorsDefault, STFloatingFooter, STInputBox, STNavigationBar, Toast, Validator } from "@stamhoofd/components";
import { LoginHelper, SessionManager, UrlHelper } from '@stamhoofd/networking';
import { Component, Mixins } from "vue-property-decorator";

@Component({
    components: {
        STNavigationBar,
        STFloatingFooter,
        STInputBox,
        LoadingButton,
        STErrorsDefault,
        PasswordStrength,
        SaveView
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


        const component = new CenteredMessage("Wachtwoord wijzigen...", "We maken gebruik van lange wiskundige berekeningen die alle gegevens beveiligen. Dit duurt maar heel even.", "loading").show()

        try {
            await LoginHelper.changePassword(SessionManager.currentSession!, this.password)
            this.dismiss({ force: true });
            UrlHelper.setUrl("/")
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
