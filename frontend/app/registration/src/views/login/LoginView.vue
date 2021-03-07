<template>
    <form class="login-view st-view auto" @submit.prevent="submit">
        <STNavigationBar title="Inloggen">
            <button slot="right" type="button" class="button icon gray close" @click="dismiss" />
        </STNavigationBar>
        <main>
            <h1>Inloggen</h1>
                    
            <STInputBox title="E-mailadres" class="max">
                <input v-model="email" class="input" placeholder="Vul jouw e-mailadres hier in" autocomplete="username" type="email" autofocus>
            </STInputBox>

            <STInputBox title="Wachtwoord" class="max">
                <button slot="right" class="button text" type="button" @click="gotoPasswordForgot">
                    <span>Vergeten</span>
                    <span class="icon help" />
                </button>
                <input v-model="password" class="input" placeholder="Vul jouw wachtwoord hier in" autocomplete="current-password" type="password">
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
import { ComponentWithProperties,HistoryManager,NavigationController,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, ConfirmEmailView, ForgotPasswordResetView, ForgotPasswordView,LoadingButton, STFloatingFooter, STInputBox, STNavigationBar, Toast } from "@stamhoofd/components"
import { LoginHelper, SessionManager } from '@stamhoofd/networking';
import { Component, Mixins } from "vue-property-decorator";

import { OrganizationManager } from '../../classes/OrganizationManager';
import SignupView from './SignupView.vue';
import OrganizationLogo from '../menu/OrganizationLogo.vue';

const throttle = (func, limit) => {
    let lastFunc;
    let lastRan;
    return function() {
        const context = this;
        // eslint-disable-next-line prefer-rest-params
        const args = arguments;
        if (!lastRan) {
            func.apply(context, args);
            lastRan = Date.now();
        } else {
            clearTimeout(lastFunc);
            lastFunc = setTimeout(function() {
                if (Date.now() - lastRan >= limit) {
                    func.apply(context, args);
                    lastRan = Date.now();
                }
            }, limit - (Date.now() - lastRan));
        }
    };
};

// The header component detects if the user scrolled past the header position and adds a background gradient in an animation
@Component({
    components: {
        STNavigationBar,
        STFloatingFooter,
        STInputBox,
        LoadingButton,
        OrganizationLogo
    }
})
export default class LoginView extends Mixins(NavigationMixin){
    loading = false;
    email = ""
    password = ""

    session = SessionManager.currentSession!

    mounted() {
        const path = window.location.pathname;
        const parts = path.substring(1).split("/");
        let clearPath = true

        if (parts.length == 1 && parts[0] == 'reset-password') {
            // tood: password reset view
            this.present(new ComponentWithProperties(ForgotPasswordResetView, {}).setDisplayStyle("popup"));
            clearPath = false
        }

        if (parts.length == 1 && parts[0] == 'verify-email') {
            const queryString = new URL(window.location.href).searchParams;
            const token = queryString.get('token')
            const code = queryString.get('code')
                
            if (token && code) {
                // tood: password reset view
                const toast = new Toast("E-mailadres valideren...", "spinner").setHide(null).show()
                LoginHelper.verifyEmail(this.session, code, token).then(() => {
                    toast.hide()
                    new Toast("E-mailadres is gevalideerd", "success green").show()
                }).catch(e => {
                    toast.hide()
                    CenteredMessage.fromError(e).addCloseButton().show()
                })
            }
        }

        if (clearPath) {
            HistoryManager.setUrl("/")   
        }
    }

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
        this.show(new ComponentWithProperties(ForgotPasswordView, {}))
    }

    async submit() {
        if (this.loading) {
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
            if ((isSimpleError(e) || isSimpleErrors(e)) && e.hasCode("invalid_signature")) {
                new CenteredMessage("Ongeldig wachtwoord of e-mailadres", "Jouw e-mailadres of wachtwoord is ongeldig. Kijk na of je wel het juiste e-mailadres of wachtwoord hebt ingegeven. Gebruik het e-mailadres waar je al e-mails van ons op ontvangt.", "error").addCloseButton().show()           
            } else {
                new CenteredMessage("Inloggen mislukt", e.human ?? e.message ?? "Er ging iets mis", "error").addCloseButton().show()           
            }
        } finally {
            this.loading = false;
            component.hide()
        }
    }
}
</script>

<style lang="scss">
    @use "~@stamhoofd/scss/base/variables.scss" as *;
    @use "~@stamhoofd/scss/base/text-styles.scss" as *;

</style>
