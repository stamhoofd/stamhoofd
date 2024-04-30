<template>
    <SaveView class="auto" data-submit-last-field title="Wachtwoord wijzigen" save-icon="lock" @save="submit">
        <h1>Wachtwoord wijzigen</h1>

        <STErrorsDefault :error-box="errorBox" />

        <input id="username" style="display: none;" type="text" name="username" autocomplete="username" :value="email">

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
import { ErrorBox, LoadingButton, PasswordStrength, SaveView, STErrorsDefault, STFloatingFooter, STInputBox, STNavigationBar, Toast, Validator } from "@stamhoofd/components";
import { LoginHelper, SessionManager } from '@stamhoofd/networking';
import { Component, Mixins } from "@simonbackx/vue-app-navigation/classes";

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

    get email() {
        return this.$context.user?.email ?? ""
    }

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

        try {
            await LoginHelper.changePassword(this.$context, this.password)
            this.dismiss({ force: true });
            new Toast('Jouw nieuwe wachtwoord is opgeslagen', "success").show()
        } catch (e) {
            this.loading = false;
            this.errorBox = new ErrorBox(e)
            return;
        }
    }
}
</script>
