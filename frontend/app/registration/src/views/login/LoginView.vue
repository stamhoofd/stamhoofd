<template>
    <form class="login-view st-view auto" @submit.prevent="submit">
        <STNavigationBar title="Inloggen">
            <button slot="right" type="button" class="button icon gray close" @click="dismiss" />
        </STNavigationBar>
        <main>
            <h1>Inloggen</h1>
                    
            <EmailInput ref="emailInput" v-model="email" class="max" name="email" title="E-mailadres" :validator="validator" placeholder="Vul jouw e-mailadres hier in" autocomplete="username" :disabled="lock !== null" />
            <p v-if="lock" class="style-description-small">
                {{ lock }}
            </p>

            <STInputBox title="Wachtwoord" class="max">
                <button slot="right" class="button text" type="button" @click="gotoPasswordForgot">
                    <span>Vergeten</span>
                    <span class="icon help" />
                </button>
                <input v-model="password" name="password" class="input" placeholder="Vul jouw wachtwoord hier in" autocomplete="current-password" type="password">
            </STInputBox>
        </main>

        <STFloatingFooter>
            <LoadingButton :loading="loading">
                <button class="button primary full">
                    <span class="lock" />
                    Inloggen
                </button>
            </LoadingButton>
        </STFloatingFooter>
    </form>
</template>

<script lang="ts">
import { isSimpleError, isSimpleErrors } from '@simonbackx/simple-errors';
import { Request } from '@simonbackx/simple-networking';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, ConfirmEmailView, EmailInput,ErrorBox, ForgotPasswordView,LoadingButton, OrganizationLogo,STFloatingFooter, STInputBox, STNavigationBar, Validator } from "@stamhoofd/components"
import { LoginHelper, SessionManager } from '@stamhoofd/networking';
import { Component, Mixins, Prop, Ref } from "vue-property-decorator";

import { OrganizationManager } from '../../classes/OrganizationManager';

// The header component detects if the user scrolled past the header position and adds a background gradient in an animation
@Component({
    components: {
        STNavigationBar,
        STFloatingFooter,
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

    get privacyUrl() {
        if (OrganizationManager.organization.meta.privacyPolicyUrl) {
            return OrganizationManager.organization.meta.privacyPolicyUrl
        }
        if (OrganizationManager.organization.meta.privacyPolicyFile) {
            return OrganizationManager.organization.meta.privacyPolicyFile.getPublicPath()
        }
        return null
    }

    returnToSite() {
        if (!this.organization.website || (!this.organization.website.startsWith("https://") && !this.organization.website.startsWith("http://"))) {
            return
        }
        window.location.href = this.organization.website
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
        
        // Request the key constants
        const component = new CenteredMessage("Inloggen...", "We maken gebruik van lange wiskundige berekeningen die alle gegevens sterk beveiligen door middel van end-to-end encryptie. Dit duurt maar heel even.", "loading").show()
        try {
            const result = await LoginHelper.login(this.session, this.email, this.password)

            if (result.verificationToken) {
                this.show(new ComponentWithProperties(ConfirmEmailView, { login: true, session: this.session, token: result.verificationToken }))
            }
        } catch (e) {
            if (Request.isNetworkError(e)) {
                new CenteredMessage("Geen internetverbinding", "Kijk jouw internetverbinding na en probeer het opnieuw.", "error").addCloseButton().show()           
            } else if ((isSimpleError(e) || isSimpleErrors(e)) && e.hasCode("invalid_signature")) {
                new CenteredMessage("Ongeldig wachtwoord of e-mailadres", "Jouw e-mailadres of wachtwoord is ongeldig. Kijk na of je wel het juiste e-mailadres of wachtwoord hebt ingegeven. Gebruik het e-mailadres waar je al e-mails van ons op ontvangt.", "error").addCloseButton().show()           
            } else {
                new CenteredMessage("Inloggen mislukt", e.human ?? e.message ?? "Er ging iets mis", "error").addCloseButton().show()           
            }
        } finally {
            this.loading = false;
            component.hide()
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