<template>
    <form class=" st-view login-view" @submit.prevent="submit">
        <STNavigationBar title="Inloggen">
            <button slot="right" type="button" class="button icon gray close" @click="dismiss" />
        </STNavigationBar>
        <main>
            <h1>Inloggen</h1>

            <STInputBox title="E-mailadres">
                <input v-model="email" class="input" placeholder="Vul jouw e-mailadres hier in" autocomplete="username" type="email">
            </STInputBox>

            <STInputBox title="Wachtwoord">
                <button slot="right" class="button text" type="button" @click="gotoPasswordForgot">
                    <span>Vergeten</span>
                    <span class="icon help" />
                </button>
                <input v-model="password" class="input" placeholder="Vul jouw wachtwoord hier in" autocomplete="current-password" type="password">
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
import { isSimpleError, isSimpleErrors } from "@simonbackx/simple-errors";
import { Request } from "@simonbackx/simple-networking";
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, ConfirmEmailView, ForgotPasswordView,LoadingButton, STFloatingFooter, STInputBox, STNavigationBar } from "@stamhoofd/components"
import { AppManager, LoginHelper, Session } from '@stamhoofd/networking';
import { Component, Mixins, Prop } from "vue-property-decorator";

@Component({
    components: {
        STNavigationBar,
        STFloatingFooter,
        STInputBox,
        LoadingButton
    }
})
export default class LoginView extends Mixins(NavigationMixin){
    @Prop({ required: true})
    session!: Session

    loading = false

    @Prop({ default: ""})
    initialEmail!: string

    email = this.initialEmail
    password = ""

    get isNative() {
        return AppManager.shared.isNative
    }

    mounted() {
        this.email = this.session.user?.email ?? ""
    }

    help() {
        new CenteredMessage("Geen account", "Vraag aan een beheerder om jou een uitnodiging te sturen. Alleen zo kan je een account aanmaken.").addCloseButton("Sluiten").show()
    }

    gotoPasswordForgot() {
        this.show(new ComponentWithProperties(ForgotPasswordView, {
            session: this.session
        }))
    }

    async submit() {
        if (this.loading) {
            return
        }

        this.loading = true
        
        // Request the key constants
        const component = new CenteredMessage("Inloggen...", "We maken gebruik van lange wiskundige berekeningen die alle gegevens sterk beveiligen door middel van end-to-end encryptie. Dit duurt maar heel even.", "loading").show()

        try {
            const result = await LoginHelper.login(this.session, this.email, this.password)

            if (result.verificationToken) {
                this.show(new ComponentWithProperties(ConfirmEmailView, { login: true, session: this.session, token: result.verificationToken }))
            } else {
                this.dismiss({ force: true });
            }
        } catch (e) {
            console.error(e)
            this.loading = false;

            if (Request.isNetworkError(e)) {
                new CenteredMessage("Geen internetverbinding", "Kijk jouw internetverbinding na en probeer het opnieuw.", "error").addCloseButton().show()           
            } else if ((isSimpleError(e) || isSimpleErrors(e)) && e.hasCode("invalid_signature")) {
                new CenteredMessage("Ongeldig wachtwoord of e-mailadres", "Jouw e-mailadres of wachtwoord is ongeldig. Kijk na of je wel het juiste e-mailadres of wachtwoord hebt ingegeven.", "error").addCloseButton().show()           
            } else {
                new CenteredMessage("Inloggen mislukt", e.human ?? e.message ?? "Er ging iets mis", "error").addCloseButton().show()           
            }         
            return;
        } finally {
            component.hide()
        }
    }
}
</script>