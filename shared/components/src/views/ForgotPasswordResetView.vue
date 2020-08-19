<template>
    <form class="forgot-password-reset-view st-view" @submit.prevent="submit">
        <STNavigationBar title="Wachtwoord opnieuw instellen">
            <button slot="right" class="button icon gray close" @click="pop" type="button"></button>
        </STNavigationBar>
        <main>
            <h1>Wachtwoord opnieuw instellen</h1>

            <p>Stel een nieuw wachtwoord in voor jouw account.</p>

            <p class="error-box" v-if="hasPermissions">Opgelet! Als je je wachtwoord opnieuw instelt verlies je toegang tot alle data van je leden. Er is geen mogelijkheid om deze hierna nog te herstellen TENZIJ een andere beheerder van jouw vereniging nog toegang heeft tot zijn account. </p>

            <STErrorsDefault :error-box="errorBox" />

            <div class="split-inputs" v-if="!loadingToken">
                <div>
                    <EmailInput title="E-mailadres" v-model="email" :validator="validator" placeholder="Vul jouw e-mailadres hier in" autocomplete="username" disabled />

                    <STInputBox title="Kies een nieuw wachtwoord">
                        <input v-model="password" class="input" placeholder="Kies een nieuw wachtwoord" autocomplete="new-password" type="password">
                    </STInputBox>

                    <STInputBox title="Herhaal wachtwoord">
                        <input v-model="passwordRepeat" class="input" placeholder="Kies een nieuw wachtwoord" autocomplete="new-password" type="password">
                    </STInputBox>
                </div>
                <div>
                    <div class="warning-box">Gebruik bij voorkeur een wachtwoordbeheerder of kies een sterk wachtwoord dat je kan onthouden.</div>
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
import { ArrayDecoder, Decoder, ObjectData } from '@simonbackx/simple-encoding';
import { ComponentWithProperties,NavigationController,NavigationMixin, HistoryManager } from "@simonbackx/vue-app-navigation";
import { NetworkManager, SessionManager, Session, LoginHelper } from '@stamhoofd/networking';
import { Component, Mixins, Prop } from "vue-property-decorator";
import { ChallengeResponseStruct,KeyConstants,NewUser, OrganizationSimple, Token, User, Version } from '@stamhoofd/structures';
import { CenteredMessage, LoadingButton, STFloatingFooter, STInputBox, STNavigationBar, STErrorsDefault, ErrorBox, EmailInput, Validator, Checkbox, Toast, Spinner } from "@stamhoofd/components"
import { Sodium } from '@stamhoofd/crypto';
import ForgotPasswordView from './ForgotPasswordView.vue';
import { SimpleError } from '@simonbackx/simple-errors';

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
        Spinner
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

    @Prop({ default: SessionManager.currentSession })
    initialSession!: Session

    session: Session | null = null

    mounted() {
        this.loadingToken = true

        const queryString = new URL(window.location.href).searchParams;
        if (queryString.get('token')) {
            const token = queryString.get('token')!;
            
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
            }).then(response => {
                // Create new session to prevent signing in
                this.session = new Session(this.initialSession.organizationId)
                this.session.organization = this.initialSession.organization

                this.session.setToken(response.data)
                
                return this.session.fetchUser()
            }).then((user) => {
                this.email = user.email
                localStorage.setItem("email", this.email)
                this.user = user
                this.loadingToken = false;
            }).catch(e => {
                new Toast("Deze link is ongeldig of vervallen. Stuur een nieuwe e-mail om je wachtwoord opnieuw in te stellen.", "error").show()
                this.dismiss({ force: true })
            })
        } else {
            new Toast("Deze link is ongeldig", "error").show()
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

        const minChars = this.hasPermissions ? 14 : 8

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
        
        const component = new ComponentWithProperties(CenteredMessage, { 
            type: "loading",
            title: "Wachtwoord wijzigen...", 
            description: "We maken gebruik van lange wiskundige berekeningen die jouw gegevens sterk beveiligen door middel van end-to-end encryptie. Dit duurt maar heel even."
        }).setDisplayStyle("overlay");
        this.present(component)

        try {
            await LoginHelper.changePassword(this.session, this.password, true)
            
            this.loading = false;
            (component.componentInstance() as any)?.pop()

            SessionManager.setCurrentSession(this.session)
            this.dismiss({ force: true })
            
        } catch (e) {
            this.loading = false;
            (component.componentInstance() as any)?.pop()

            this.errorBox = new ErrorBox(e)

            const errorMessage = new ComponentWithProperties(CenteredMessage, { 
                type: "error",
                title: "Er ging iets mis", 
                description: "Het is niet gelukt om de sleutels aan te maken. Probeer het op een ander toestel of browser opnieuw uit of neem contact met ons op.",
                closeButton: "Sluiten",
            }).setDisplayStyle("overlay");
            this.present(errorMessage)
            return;
        }
        
    }
}
</script>