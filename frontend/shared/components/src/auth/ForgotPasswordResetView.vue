<template>
    <LoadingViewTransition>
        <form v-if="!loadingSession" key="form" class="forgot-password-reset-view st-view" @submit.prevent="submit">
            <STNavigationBar :title="title" />
            <main>
                <h1>{{ title }}</h1>

                <p>{{ description }}</p>

                <STErrorsDefault :error-box="errorBox" />

                <STInputBox v-if="!hasAccount" title="Jouw naam" error-fields="firstName,lastName" :error-box="errorBox">
                    <div class="input-group">
                        <div>
                            <input v-model="firstName" class="input" type="text" placeholder="Voornaam" autocomplete="given-name">
                        </div>
                        <div>
                            <input v-model="lastName" class="input" type="text" placeholder="Achternaam" autocomplete="family-name">
                        </div>
                    </div>
                </STInputBox>
                <EmailInput v-model="email" title="Persoonlijk e-mailadres" :validator="validator" placeholder="Vul jouw e-mailadres hier in" autocomplete="username" />
                <div class="split-inputs">
                    <div>
                        <STInputBox title="Kies een nieuw wachtwoord">
                            <input v-model="password" class="input" placeholder="Kies een nieuw wachtwoord" autocomplete="new-password" type="password">
                        </STInputBox>

                        <STInputBox title="Herhaal wachtwoord">
                            <input v-model="passwordRepeat" class="input" placeholder="Herhaal nieuw wachtwoord" autocomplete="new-password" type="password">
                        </STInputBox>
                    </div>
                    <div>
                        <PasswordStrength v-model="password" />
                    </div>
                </div>

                <SignupPoliciesBox :validator="validator">
                    <LoadingButton :loading="loading" class="block input-spacing">
                        <button id="submit" class="button primary" type="submit">
                            <span class="icon lock" />
                            <span>{{ buttonText }}</span>
                        </button>
                    </LoadingButton>
                </SignupPoliciesBox>
            </main>
        </form>
    </LoadingViewTransition>
</template>

<script lang="ts">
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";
import { Checkbox, ConfirmEmailView, EmailInput, ErrorBox, LoadingButton, LoadingViewTransition, PasswordStrength, ReplaceRootEventBus, Spinner, STErrorsDefault, STFloatingFooter, STInputBox, STNavigationBar, Toast, Validator } from "@stamhoofd/components";
import { LoginHelper, SessionContext, SessionManager } from '@stamhoofd/networking';
import { NewUser, Token } from '@stamhoofd/structures';
import SignupPoliciesBox from './components/SignupPoliciesBox.vue';

// The header component detects if the user scrolled past the header position and adds a background gradient in an animation
@Component({
    components: {
        STNavigationBar,
        STFloatingFooter,
        STInputBox,
        LoadingButton,
        STErrorsDefault,
        EmailInput,
        Checkbox,
        Spinner,
        PasswordStrength,
        LoadingViewTransition,
        SignupPoliciesBox
    }
})
export default class ForgotPasswordResetView extends Mixins(NavigationMixin){
    loading = false;
    loadingToken = true;
    email = ""
    password = ""
    firstName = ""
    lastName = ""

    passwordRepeat = ""

    errorBox: ErrorBox | null = null
    validator = new Validator()

    @Prop({ required: true })
        token!: string

    session: SessionContext | null = null

    acceptPrivacy = false
    acceptTerms = false
    acceptDataAgreement = false
    hasAccount = false;

    get loadingSession() {
        return !this.session || !this.session.user || this.loadingToken
    }

    get title() {
        return this.hasAccount ? 'Wachtwoord opnieuw instellen' : 'Account aanmaken'
    }

    get description() {
        return this.hasAccount ? 'Stel een nieuw wachtwoord in voor jouw account.' : 'Kies een wachtwoord voor jouw nieuwe account'
    }

    get buttonText() {
        return this.hasAccount ? 'Wachtwoord wijzigen' : 'Account aanmaken'
    }

    mounted() {
        this.loadingToken = true

        if (this.token) {
            const token = this.token
            
            this.loadingToken = true;

            this.$context.server.request({
                method: "POST",
                path: "/oauth/token",
                body: {
                    // eslint-disable-next-line @typescript-eslint/camelcase
                    grant_type: "password_token",
                    // eslint-disable-next-line @typescript-eslint/camelcase
                    token: token
                },
                decoder: Token
            }).then(async (response) => {
                // Create new session to prevent signing in
                this.session = new SessionContext(this.$context.organization)
                // We don't want to save this session or reuse it on the next loads (yet)
                this.session.disableStorage()
                await this.session.setToken(response.data)
                await this.session.updateData(false, false)
                return this.session
            })
                .then((session) => {
                    this.email = session.user?.email ?? ''
                    this.firstName = session.user?.firstName ?? ''
                    this.lastName = session.user?.lastName ?? ''
                    this.hasAccount = session.user?.hasAccount ?? false
                    this.loadingToken = false;
                }).catch(e => {
                    new Toast("Deze link is ongeldig of vervallen. Stuur een nieuwe e-mail om je wachtwoord opnieuw in te stellen.", "error red").show()
                    this.dismiss({ force: true })
                })
        } else {
            new Toast("Deze link is ongeldig", "error red").show()
            this.dismiss({ force: true })
        }
    }

    get hasPermissions() {
        return this.session && this.session.user && !!this.session.user.permissions
    }

    async submit() {
        if (this.loading || this.loadingToken || !this.session) {
            return
        }

        if (!this.hasAccount) {
            try {
                const errors = new SimpleErrors()
                if (this.firstName.length < 2) {
                    errors.addError(new SimpleError({
                        code: "invalid_field",
                        message: "Vul jouw voornaam in",
                        field: "firstName"
                    }))
                }
                if (this.lastName.length < 2) {
                    errors.addError(new SimpleError({
                        code: "invalid_field",
                        message: "Vul jouw achternaam in",
                        field: "lastName"
                    }))
                }
                errors.throwIfNotEmpty()
            } catch (e) {
                this.errorBox = new ErrorBox(e)
                return
            } 
        }
        
        const valid = await this.validator.validate()

        if (this.password !== this.passwordRepeat) {
            this.errorBox = new ErrorBox(new SimpleError({
                code: "",
                message: "De ingevoerde wachtwoorden komen niet overeen"
            }))
            return;
        }

        const minChars = 8

        if (this.password.length < minChars) {
            this.errorBox = new ErrorBox(new SimpleError({
                code: "",
                message: "Jouw wachtwoord moet uit minstens "+minChars+" karakters bestaan."
            }))
            return;
        }

        if (!valid) {
            this.errorBox = null
            return;
        }

        this.loading = true
        
        // Request the key constants
        try {
            const patch = this.hasAccount ?
                NewUser.patch({
                    id: this.session.user!.id,
                    password: this.password,
                    email: this.email
                }) : NewUser.patch({
                    id: this.session.user!.id,
                    password: this.password,
                    email: this.email,
                    firstName: this.firstName,
                    lastName: this.lastName
                })

            // Also change the email if it has been changed
            const {verificationToken} = await LoginHelper.patchUser(this.session, patch)
            //await SessionManager.setCurrentSession(this.session)
            await SessionManager.prepareSessionForUsage(this.session)

            // todo: switch current $context to session

            // If email has been changed or needs verification
            if (verificationToken) {
                // Present instead of show, because the confirm is only needed to change the email address
                this.present(new ComponentWithProperties(ConfirmEmailView, { token: verificationToken, email: this.email }).setDisplayStyle("sheet"))
            }

            if (this.hasAccount) {
                const toast = new Toast('Jouw nieuwe wachtwoord is opgeslagen', "success green")
                toast.show()
            } else {
                const toast = new Toast('Jouw account is aangemaakt', "success green")
                toast.show()
            }

            const dashboard = await import('@stamhoofd/dashboard')
            const root = await dashboard.getScopedAutoRoot(this.session)
            await ReplaceRootEventBus.sendEvent('replace', root)

            this.dismiss({ force: true })
            this.loading = false;
        } catch (e) {
            this.loading = false;
            this.errorBox = new ErrorBox(e)
            return;
        }
        
    }
}
</script>
