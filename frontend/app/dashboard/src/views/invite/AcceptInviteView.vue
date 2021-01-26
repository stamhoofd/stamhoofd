<template>
    <form class="st-view accept-invite-view" @submit.prevent="submit">
        <STNavigationBar title="Uitnodiging">
            <button slot="right" type="button" class="button icon gray close" @click="dismiss" />
        </STNavigationBar>
        <main>
            <h1 v-if="invite.sender.firstName">
                Uitnodiging van {{ invite.sender.firstName }}
            </h1>
            <h1 v-else>
                Uitnodiging
            </h1>
            

            <template v-if="!loggedIn">
                <p v-if="invite.sender.firstName">
                    {{ invite.sender.firstName }} heeft jou uitgenodigd als beheerder van {{ invite.organization.name }}. Maak een account aan (of log in) om toegang te krijgen tot alle inschrijvingen.
                </p>
                <p v-if="invite.userDetails && invite.userDetails.email" class="info-box">
                    Je kan jouw e-mailadres wijzigen nadat je een account hebt aangemaakt. Je moet eerst bewijzen dat dit jouw e-mailadres is.
                </p>
                <STErrorsDefault :error-box="errorBox" />

                <div class="split-inputs">
                    <div>
                        <EmailInput v-model="email" title="Persoonlijk e-mailadres" :validator="validator" placeholder="Vul jouw e-mailadres hier in" autocomplete="username" :disabled="invite.userDetails && invite.userDetails.email" />
                    </div>
                    <div>
                        <STInputBox title="Jouw naam" error-fields="firstName,lastName" :error-box="errorBox">
                            <div class="input-group">
                                <div>
                                    <input v-model="firstName" class="input" type="text" placeholder="Voornaam" autocomplete="given-name">
                                </div>
                                <div>
                                    <input v-model="lastName" class="input" type="text" placeholder="Achternaam" autocomplete="family-name">
                                </div>
                            </div>
                        </STInputBox>
                    </div>
                </div>

                <div class="split-inputs">
                    <div>
                        <STInputBox title="Kies een wachtwoord" error-fields="password" :error-box="errorBox">
                            <input v-model="password" class="input" placeholder="Kies een wachtwoord" autocomplete="new-password" type="password">
                        </STInputBox>

                        <STInputBox title="Herhaal wachtwoord" error-fields="passwordRepeat" :error-box="errorBox">
                            <input v-model="passwordRepeat" class="input" placeholder="Herhaal wachtwoord" autocomplete="new-password" type="password">
                        </STInputBox>
                    </div>
                    <div>
                        <PasswordStrength v-model="password" />
                    </div>
                </div>
            </template>

            <template v-else>
                <p v-if="invite.sender.firstName">
                    {{ invite.sender.firstName }} heeft jou uitgenodigd als beheerder van {{ invite.organization.name }}.
                </p>
                <STErrorsDefault :error-box="errorBox" />
            </template>
        </main>

        <STToolbar>
            <template slot="right">
                <button v-if="!loggedIn" class="button secundary" type="button" @click="tryLogin">
                    Ik heb al een account
                </button>
                <LoadingButton :loading="loading">
                    <button v-if="!loggedIn" class="button primary">
                        <span class="icon lock" />
                        <span>Account aanmaken</span>
                    </button>
                    <button v-else class="button primary">
                        <span class="icon success" />
                        <span>Uitnodiging accepteren</span>
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </form>
</template>

<script lang="ts">
import { ArrayDecoder,Decoder, ObjectData, StringDecoder, VersionBoxDecoder } from '@simonbackx/simple-encoding';
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties,NavigationController,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, ConfirmEmailView, EmailInput,ErrorBox, LoadingButton, STErrorsDefault, STToolbar, STInputBox, STNavigationBar, Validator, PasswordStrength } from "@stamhoofd/components"
import { Sodium } from '@stamhoofd/crypto';
import { LoginHelper,NetworkManager,Session, SessionManager } from '@stamhoofd/networking';
import { ChallengeResponseStruct,Invite, InviteKeychainItem, InviteUserDetails, KeychainItem, KeyConstants,NewUser, OrganizationSimple, Token, TradedInvite,User, Version } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "vue-property-decorator";

import LoginView from '../login/LoginView.vue';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        LoadingButton,
        EmailInput,
        STErrorsDefault,
        PasswordStrength
    }
})
export default class AcceptInviteView extends Mixins(NavigationMixin){
    @Prop({ required: true})
    invite!: Invite    

    @Prop({ required: true})
    secret!: string 

    loading = false

    firstName = this.invite.receiver?.firstName ?? this.invite?.userDetails?.firstName ?? "?"
    lastName = this.invite.receiver?.lastName ?? this.invite.userDetails?.lastName ?? ""

    email = this.invite.userDetails?.email ?? ""
    password = ""
    passwordRepeat = ""

    errorBox: ErrorBox | null = null
    validator = new Validator()

    session: Session | null = SessionManager.getSessionForOrganization(this.invite.organization.id) ?? null
    loggedIn = false

    mounted() {
        SessionManager.addListener(this, this.updateSession.bind(this))
        this.updateSession()
    }

    beforeDestroy() {
        SessionManager.removeListener(this)
    }

    updateSession() {
        this.session = SessionManager.getSessionForOrganization(this.invite.organization.id) ?? null
        this.loggedIn = !!this.session && this.session.isComplete()
    }

    tryLogin() {
        const session = SessionManager.getSessionForOrganization(this.invite.organization.id)
        if (session && session.canGetCompleted()) {
            SessionManager.setCurrentSession(session)
            return
        }
        this.present(new ComponentWithProperties(NavigationController, { root: new ComponentWithProperties(LoginView, { 
            initialEmail: this.email,
            organization: this.invite.organization
        }) }).setDisplayStyle("sheet"))
    }

    async submit() {
        if (this.loading) {
            return
        }
        this.loading = true

        try {
            // First need to create an account in this organization (required)
            if (!this.loggedIn) {
                const valid = await this.validator.validate()

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

                if (this.password != this.passwordRepeat) {
                    throw new SimpleError({
                        code: "",
                        message: "De ingevoerde wachtwoorden komen niet overeen",
                        field: "passwordRepeat"
                    })
                }

                if (this.password.length < 8) {
                    throw new SimpleError({
                        code: "",
                        message: "Jouw wachtwoord moet uit minstens 8 karakters bestaan.",
                        field: "password"
                    })
                }

                if (!valid) {
                    this.loading = false 
                    this.errorBox = null
                    return;
                }
                this.errorBox = null

                const component = new CenteredMessage("Account aanmaken...", "We maken gebruik van lange wiskundige berekeningen die alle gegevens sterk beveiligen door middel van end-to-end encryptie. Dit duurt maar heel even.", "loading").show()
                try {
                    if (!this.session) {
                        this.session = new Session(this.invite.organization.id)
                    }

                    const token = await LoginHelper.signUp(this.session, this.email, this.password, this.firstName, this.lastName);
                    LoginHelper.saveInvite(this.invite, this.secret)
                    this.show(new ComponentWithProperties(ConfirmEmailView, { token, session: this.session }))
                } catch (e) {
                    component.hide()
                    throw e;
                }
                
                component.hide()
            } else {
                await LoginHelper.tradeInvite(this.session!, this.invite.key, this.secret)
                SessionManager.clearCurrentSession()
                await SessionManager.setCurrentSession(this.session!)
                this.dismiss({ force: true })
            }

        } catch (e) {
            this.errorBox = new ErrorBox(e)
            console.error(e)
        }
       
        this.loading = false 
    }
}
</script>