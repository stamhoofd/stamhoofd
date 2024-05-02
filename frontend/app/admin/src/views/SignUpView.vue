<template>
    <div class="view">
        <form class="signup-view st-view" @submit.prevent="submit">
            <STNavigationBar title="Account aanmaken" />

            <main>
                <h1>Account aanmaken</h1>

                <STErrorsDefault :error-box="errorBox" />

                <EmailInput ref="emailInput" v-model="email" title="E-mailadres" :validator="validator" placeholder="Vul jouw e-mailadres hier in" autocomplete="username" />

                <div class="split-inputs">
                    <div>
                        <STInputBox title="Kies een wachtwoord">
                            <input v-model="password" class="input" placeholder="Kies een nieuw wachtwoord" autocomplete="new-password" type="password" @input="password = $event.target.value" @change="password = $event.target.value">
                        </STInputBox>

                        <STInputBox title="Herhaal wachtwoord">
                            <input v-model="passwordRepeat" class="input" placeholder="Kies een nieuw wachtwoord" autocomplete="new-password" type="password" @input="passwordRepeat = $event.target.value" @change="passwordRepeat = $event.target.value">
                        </STInputBox>
                    </div>
                    <div>
                        <PasswordStrength v-model="password" />
                    </div>
                </div>
            </main>

            <STToolbar>
                <template #right>
                    <LoadingButton :loading="loading">
                        <button class="button primary full">
                            <span class="icon lock" />
                            <span>Account aanmaken</span>
                        </button>
                    </LoadingButton>
                </template>
            </STToolbar>
        </form>
    </div>
</template>

<script lang="ts">
import { Decoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { EmailInput, ErrorBox, LoadingButton, PasswordStrength,STErrorsDefault, STInputBox, STNavigationBar, STToolbar, Validator } from "@stamhoofd/components"
import { UrlHelper } from '@stamhoofd/networking';
import { Token } from '@stamhoofd/structures';
import { Component, Mixins, Ref } from "@simonbackx/vue-app-navigation/classes";

import { AdminSession } from '../classes/AdminSession';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        LoadingButton,
        STErrorsDefault,
        EmailInput,
        PasswordStrength
    }
})
export default class SignupView extends Mixins(NavigationMixin){
    loading = false;

    email = ""
    password = ""
    passwordRepeat = ""

    errorBox: ErrorBox | null = null
    validator = new Validator()

    @Ref("emailInput")
        emailInput: EmailInput

    async submit() {
        if (this.loading) {
            return
        }       

        const valid = await this.validator.validate()

        if (this.password != this.passwordRepeat) {
            this.errorBox = new ErrorBox(new SimpleError({
                code: "",
                message: "De ingevoerde wachtwoorden komen niet overeen"
            }))
            return;
        }

        if (this.password.length < 16) {
            this.errorBox = new ErrorBox(new SimpleError({
                code: "",
                message: "Jouw wachtwoord moet uit minstens 16 karakters bestaan."
            }))
            return;
        }

        if (!valid) {
            this.errorBox = null
            return;
        }

        this.loading = true
        this.errorBox = null
        // Request the key constants
        
        try {
            const response = await AdminSession.shared.server.request({
                method: "POST",
                path: "/oauth/register",
                body: {
                    email: this.email,
                    password: this.password,
                },
                decoder: Token as Decoder<Token>
            })
            const token = response.data
            AdminSession.shared.setToken(token)
            await AdminSession.shared.updateData(true)
        } catch (e) {
            console.error(e)
            this.errorBox = new ErrorBox(e)
        }
        this.loading = false;
    }

    mounted() {
        UrlHelper.setUrl("/register")
        setTimeout(() => {
            this.emailInput.focus()
        }, 300);
    }
}
</script>