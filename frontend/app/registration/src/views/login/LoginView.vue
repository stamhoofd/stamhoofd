<template>
    <form class="login-view st-view auto" data-submit-last-field @submit.prevent="submit">
        <STNavigationBar title="Inloggen">
            <button slot="right" type="button" class="button icon gray close" @click="dismiss" />
        </STNavigationBar>
        <main>
            <h1>Inloggen</h1>
            <STErrorsDefault :error-box="errorBox" />

            <EmailInput ref="emailInput" v-model="email" class="max" name="username" title="E-mailadres" :validator="validator" placeholder="Vul jouw e-mailadres hier in" autocomplete="username" :disabled="lock !== null" />
            <p v-if="lock" class="style-description-small">
                {{ lock }}
            </p>

            <STInputBox title="Wachtwoord" class="max">
                <button slot="right" class="button text" type="button" tabindex="-1" @click="gotoPasswordForgot">
                    <span>Vergeten</span>
                    <span class="icon help" />
                </button>
                <input v-model="password" name="password" class="input" placeholder="Vul jouw wachtwoord hier in" autocomplete="current-password" type="password" @input="password = $event.target.value" @change="password = $event.target.value">
            </STInputBox>
        </main>

        <STFloatingFooter>
            <LoadingButton :loading="loading">
                <button class="button primary full" type="submit">
                    <span class="icon lock" />
                    <span>Inloggen</span>
                </button>
            </LoadingButton>
        </STFloatingFooter>
    </form>
</template>

<script lang="ts">
import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, ConfirmEmailView, EmailInput, ErrorBox, ForgotPasswordView, LoadingButton, OrganizationLogo, STErrorsDefault, STFloatingFooter, STInputBox, STNavigationBar, Validator } from "@stamhoofd/components";
import { LoginHelper, SessionManager } from '@stamhoofd/networking';
import { Component, Mixins, Prop, Ref } from "vue-property-decorator";

import { OrganizationManager } from '../../classes/OrganizationManager';

// The header component detects if the user scrolled past the header position and adds a background gradient in an animation
@Component({
    components: {
        STNavigationBar,
        STFloatingFooter,
        STErrorsDefault,
        STInputBox,
        LoadingButton,
        OrganizationLogo,
        EmailInput
    }
})
export default class LoginView extends Mixins(NavigationMixin){
    loading = false;

    @Prop({ default: ""})
        initialEmail!: string

    @Prop({ default: null})
        lock!: string | null

    @Ref("emailInput")
        emailInput: EmailInput

    email = this.initialEmail
    password = ""

    session = SessionManager.currentSession!

    errorBox: ErrorBox | null = null
    validator = new Validator()

    get organization() {
        return OrganizationManager.organization
    }

    gotoPasswordForgot() {
        this.show(new ComponentWithProperties(ForgotPasswordView, { initialEmail: this.email }))
    }

    async submit() {
        if (this.loading) {
            return
        }

        const valid = await this.validator.validate()

        if (!valid) {
            return
        }

        if (this.email.length < 3 || this.password.length < 5) {
            new CenteredMessage("Vul eerst iets in", "Je hebt geen correcte gegevens ingevuld", "error").addCloseButton().show()   
            return
        }

        this.loading = true
        
        try {
            const result = await LoginHelper.login(this.session, this.email, this.password)

            if (result.verificationToken) {
                this.show(new ComponentWithProperties(ConfirmEmailView, { login: true, session: this.session, token: result.verificationToken, email: this.email }))
            }
        } catch (e) {
            if ((isSimpleError(e) || isSimpleErrors(e)) && e.hasCode("invalid_signature")) {
                this.errorBox = new ErrorBox(new SimpleError({
                    code: "invalid_signature",
                    message: "Jouw e-mailadres of wachtwoord is ongeldig. Kijk na of je wel het juiste e-mailadres of wachtwoord hebt ingegeven. Gebruik het e-mailadres waar je al e-mails van ons op ontvangt."
                }))
            } else {
                this.errorBox = new ErrorBox(e)
            }
        } finally {
            this.loading = false;
        }
    }

    mounted() {
        setTimeout(() => {
            // Needed the any here because typescript is getting mad only in production mode
            if (this.emailInput) {
                (this.emailInput as any).focus()
            }
        }, 300);
    }
}
</script>