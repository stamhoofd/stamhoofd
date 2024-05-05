<template>
    <form class=" st-view login-view" data-submit-last-field @submit.prevent="submit">
        <STNavigationBar title="Inloggen" />
        <main class="center small">
            <h1>Inloggen</h1>

            <STErrorsDefault :error-box="errorBox" />

            <EmailInput ref="emailInput" v-model="email" enterkeyhint="next" class="max" name="username" title="E-mailadres" :validator="validator" placeholder="Vul jouw e-mailadres hier in" autocomplete="username" :disabled="animating || lock !== null" />
            <p v-if="lock" class="style-description-small">
                {{ lock }}
            </p>

            <STInputBox title="Wachtwoord" class="max">
                <template #right><button class="button text" type="button" tabindex="-1" @click.prevent="gotoPasswordForgot">
                    <span>Vergeten</span>
                    <span class="icon help" />
                </button></template>
                <input v-model="password" enterkeyhint="go" class="input" name="current-password" placeholder="Vul jouw wachtwoord hier in" autocomplete="current-password" type="password" @input="password = $event.target.value" @change="password = $event.target.value">
            </STInputBox>


            <button class="button text" type="button" tabindex="-1" @click="help">
                <span class="help icon" />
                <span>Ik heb geen account</span>
            </button>

            <LoadingButton :loading="loading" class="block bottom">
                <button class="button primary full" type="submit">
                    <span class="lock icon" />
                    <span>Inloggen</span>
                </button>
            </LoadingButton>
        </main>
    </form>
</template>

<script lang="ts">
import { isSimpleError, isSimpleErrors, SimpleError } from "@simonbackx/simple-errors";
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, ConfirmEmailView, EmailInput, ErrorBox, ForgotPasswordView, LoadingButton, STErrorsDefault, STFloatingFooter, STInputBox, STNavigationBar, Validator } from "@stamhoofd/components";
import { AppManager, LoginHelper, Session, SessionManager, UrlHelper } from '@stamhoofd/networking';
import { Component, Mixins, Prop, Ref } from "@simonbackx/vue-app-navigation/classes";

@Component({
    components: {
        STNavigationBar,
        STFloatingFooter,
        STErrorsDefault,
        STInputBox,
        LoadingButton,
        EmailInput
    },
})
export default class LoginView extends Mixins(NavigationMixin){
    loading = false

    @Prop({ default: ""})
        initialEmail!: string

    @Prop({ default: null})
        lock!: string | null

    email = this.initialEmail
    password = ""

    errorBox: ErrorBox | null = null
    validator = new Validator()

    // Prevent browsers from already autofocusing the input on animation
    animating = true

    get isNative() {
        return AppManager.shared.isNative
    }

    @Ref("emailInput")
        emailInput: EmailInput

    mounted() {
        this.email = this.initialEmail ? this.initialEmail : (this.$context.user?.email ?? "");

        if (this.email.length == 0) {
            setTimeout(() => {
                this.animating = false;
                // Needed the any here because typescript is getting mad only in production mode
                if (this.emailInput) {
                    (this.emailInput as any).focus()
                }
            }, 300);
        } else {
            setTimeout(() => {
                // Needed the any here because typescript is getting mad only in production mode
                this.animating = false;
            }, 300);
        }

        UrlHelper.shared.clear()

        // Reset url if we log out
        console.log('seturl', '/login')
        UrlHelper.setUrl("/login")
    }

    help() {
        new CenteredMessage("Geen account", "Deze site is enkel voor beheerders van verenigingen. Ben je zelf een beheerder? Vraag aan een beheerder om jou een uitnodiging te sturen. Alleen zo kan je een account aanmaken. Ben je een ouder/lid? Dan moet je inloggen via het ledenportaal van jouw vereniging, vraag die link na bij jouw vereniging of kijk op hun website.").addCloseButton("Sluiten").show()
    }

    gotoPasswordForgot() {
        this.show(new ComponentWithProperties(ForgotPasswordView, {
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
        
        try {
            const result = await LoginHelper.login(this.$context, this.email, this.password)

            if (result.verificationToken) {
                this.present({
                    components: [
                        new ComponentWithProperties(ConfirmEmailView, { login: true, token: result.verificationToken, email: this.email })
                    ],
                    modalDisplayStyle: "popup"
                })
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
    }
}
</script>