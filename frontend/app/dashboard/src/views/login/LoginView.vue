<template>
    <form class=" st-view login-view" @submit.prevent="submit">
        <STNavigationBar title="Inloggen">
            <button slot="right" type="button" class="button icon gray close" @click="dismiss" />
        </STNavigationBar>
        <main>
            <h1>Inloggen</h1>

            <STErrorsDefault :error-box="errorBox" />

            <EmailInput ref="emailInput" v-model="email" class="max" name="email" title="E-mailadres" :validator="validator" placeholder="Vul jouw e-mailadres hier in" autocomplete="username" :disabled="lock !== null" />
            <p v-if="lock" class="style-description-small">
                {{ lock }}
            </p>

            <STInputBox title="Wachtwoord">
                <button slot="right" class="button text" type="button" @click.prevent="gotoPasswordForgot">
                    <span>Vergeten</span>
                    <span class="icon help" />
                </button>
                <input v-model="password" class="input" name="current-password" placeholder="Vul jouw wachtwoord hier in" autocomplete="current-password" type="password">
            </STInputBox>
        </main>

        <STFloatingFooter class="no-sticky">
            <LoadingButton :loading="loading">
                <button class="button primary full">
                    <span class="lock icon" />
                    <span>Inloggen</span>
                </button>
            </LoadingButton>
            <button class="button secundary full" type="button" @click="help">
                <span class="help icon" />
                <span>Geen account?</span>
            </button>
        </STFloatingFooter>
    </form>
</template>

<script lang="ts">
import { isSimpleError, isSimpleErrors, SimpleError } from "@simonbackx/simple-errors";
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, ConfirmEmailView, EmailInput, ErrorBox, ForgotPasswordView, LoadingButton, STErrorsDefault, STFloatingFooter, STInputBox, STNavigationBar, Validator } from "@stamhoofd/components";
import { AppManager, LoginHelper, Session } from '@stamhoofd/networking';
import { Component, Mixins, Prop, Ref } from "vue-property-decorator";

@Component({
    components: {
        STNavigationBar,
        STFloatingFooter,
        STErrorsDefault,
        STInputBox,
        LoadingButton,
        EmailInput
    }
})
export default class LoginView extends Mixins(NavigationMixin){
    @Prop({ required: true})
    session!: Session

    loading = false

    @Prop({ default: ""})
    initialEmail!: string

    @Prop({ default: null})
    lock!: string | null

    email = this.initialEmail
    password = ""

    errorBox: ErrorBox | null = null
    validator = new Validator()

    get isNative() {
        return AppManager.shared.isNative
    }

    @Ref("emailInput")
    emailInput: HTMLInputElement

    mounted() {
        this.email = this.initialEmail ? this.initialEmail : (this.session.user?.email ?? "")

        if (this.email.length == 0) {
            setTimeout(() => {
                // Needed the any here because typescript is getting mad only in production mode
                if (this.emailInput) {
                    (this.emailInput as any).focus()
                }
            }, 300);
        }
    }

    help() {
        new CenteredMessage("Geen account", "Vraag aan een beheerder om jou een uitnodiging te sturen. Alleen zo kan je een account aanmaken.").addCloseButton("Sluiten").show()
    }

    gotoPasswordForgot() {
        this.show(new ComponentWithProperties(ForgotPasswordView, {
            session: this.session,
            initialEmail: this.email,
            isAdmin: true
        }))
    }

    async submit() {
        if (this.loading) {
            return
        }

        const valid = await this.validator.validate()

        if (!valid) {
            return
        }


        this.loading = true
        
        // Request the key constants
        const component = new CenteredMessage("Inloggen...", "We maken gebruik van lange wiskundige berekeningen die alle gegevens sterk beveiligen door middel van end-to-end encryptie. Dit duurt maar heel even.", "loading").show()

        try {
            const result = await LoginHelper.login(this.session, this.email, this.password)

            if (result.verificationToken) {
                this.show(new ComponentWithProperties(ConfirmEmailView, { login: true, session: this.session, token: result.verificationToken, email: this.email }))
            } else {
                this.dismiss({ force: true });
            }
        } catch (e) {
            if ((isSimpleError(e) || isSimpleErrors(e)) && e.hasCode("invalid_signature")) {
                this.errorBox = new ErrorBox(new SimpleError({
                    code: "invalid_signature",
                    message: "Jouw e-mailadres of wachtwoord is ongeldig. Kijk na of je wel het juiste e-mailadres of wachtwoord hebt ingegeven."
                }))
            } else {
                this.errorBox = new ErrorBox(e)
            }  
        }
        this.loading = false;
        component.hide()
    }
}
</script>