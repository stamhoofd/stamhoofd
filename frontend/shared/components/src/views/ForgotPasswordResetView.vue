<template>
    <form class="forgot-password-reset-view st-view" @submit.prevent="submit">
        <STNavigationBar title="Wachtwoord opnieuw instellen">
            <button slot="right" class="button icon gray close" type="button" @click="pop" />
        </STNavigationBar>
        <main>
            <h1>Wachtwoord opnieuw instellen</h1>

            <p>Stel een nieuw wachtwoord in voor jouw account.</p>

            <p v-if="hasPermissions" class="error-box">
                Opgelet! Als je je wachtwoord opnieuw instelt verlies je toegang tot alle data van je leden. Er is geen mogelijkheid om deze hierna nog te herstellen TENZIJ een andere beheerder van jouw vereniging nog toegang heeft tot zijn account.
            </p>
            <p v-else class="warning-box">
                Hou er rekening mee dat we jouw account terug moeten goedkeuren als je jouw wachtwoord bent vergeten.
            </p>

            <STErrorsDefault :error-box="errorBox" />
            
            <EmailInput v-if="!loadingToken" v-model="email" title="E-mailadres" :validator="validator" placeholder="Vul jouw e-mailadres hier in" autocomplete="username" disabled />
            <p class="style-description-small">
                Je kan jouw e-mailadres wijzigen na het inloggen.
            </p>

            <div v-if="!loadingToken" class="split-inputs">
                <div>
                    <STInputBox title="Kies een nieuw wachtwoord">
                        <input v-model="password" class="input" placeholder="Kies een nieuw wachtwoord" autocomplete="new-password" type="password" @input="password = $event.target.value" @change="password = $event.target.value">
                    </STInputBox>

                    <STInputBox title="Herhaal wachtwoord">
                        <input v-model="passwordRepeat" class="input" placeholder="Herhaal nieuw wachtwoord" autocomplete="new-password" type="password" @input="passwordRepeat = $event.target.value" @change="passwordRepeat = $event.target.value">
                    </STInputBox>
                </div>
                <div>
                    <PasswordStrength v-model="password" />
                </div>
            </div>
            <Spinner v-else />
        </main>

        <STFloatingFooter>
            <LoadingButton :loading="loading">
                <button class="button primary full">
                    <span class="icon lock" />
                    <span>Wachtwoord wijzigen</span>
                </button>
            </LoadingButton>
        </STFloatingFooter>
    </form>
</template>

<script lang="ts">
import { SimpleError } from '@simonbackx/simple-errors';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Checkbox, EmailInput, ErrorBox, LoadingButton, PasswordStrength,Spinner,STErrorsDefault, STFloatingFooter, STInputBox, STNavigationBar, Toast, Validator } from "@stamhoofd/components"
import { LoginHelper, Session, SessionManager } from '@stamhoofd/networking';
import { NewUser, Token } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "vue-property-decorator";

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
        PasswordStrength
    }
})
export default class ForgotPasswordResetView extends Mixins(NavigationMixin){
    loading = false;
    loadingToken = true;
    email = ""
    password = ""
    passwordRepeat = ""
    acceptPrivacy = false

    errorBox: ErrorBox | null = null
    validator = new Validator()
    user: NewUser | null = null;

    @Prop({ default: () => SessionManager.currentSession })
    initialSession!: Session

    @Prop({ required: true })
    token!: string

    session: Session | null = null

    mounted() {
        this.loadingToken = true

        if (this.token) {
            const token = this.token
            
            this.loadingToken = true;

            this.initialSession.server.request({
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
                this.session = new Session(this.initialSession.organizationId)
                await this.session.loadFromStorage()
                this.session.setToken(response.data)
                this.session.organization = this.initialSession.organization
                return await this.session.fetchUser()
            })
                .then((user) => {
                    this.email = user.email
                    localStorage.setItem("email", this.email)
                    this.user = user
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
        return this.user && !!this.user.permissions
    }

    async submit() {
        if (this.loading || this.loadingToken || !this.session) {
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
        const component = new CenteredMessage("Wachtwoord wijzigen...", "We maken gebruik van lange wiskundige berekeningen die jouw gegevens beveiligen. Dit duurt maar heel even.", "loading").show()

        try {
            await LoginHelper.changePassword(this.session, this.password, true)
            
            this.loading = false;
            component.hide()

            SessionManager.setCurrentSession(this.session)
            this.dismiss({ force: true })
            
        } catch (e) {
            this.loading = false;
            component.hide()

            this.errorBox = new ErrorBox(e)

            new CenteredMessage("Er ging iets mis", "Het is niet gelukt om jouw wachtwoord te wijzigen. Probeer het op een ander toestel of browser opnieuw uit of neem contact met ons op.", "error").addCloseButton().show()
            return;
        }
        
    }
}
</script>