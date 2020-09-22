<template>
    <form class="st-view accept-invite-view" @submit.prevent="submit">
        <STNavigationBar title="Uitnodiging">
            <button slot="right" type="button" class="button icon gray close" @click="dismiss" />
        </STNavigationBar>
        <main>
            <h1 v-if="invite.sender.firstName">Uitnodiging van {{ invite.sender.firstName }}</h1>
            <h1 v-else>Uitnodiging</h1>
            
            <STErrorsDefault :error-box="errorBox" />

            <template v-if="!loggedIn">
                <p class="st-list-description" v-if="invite.sender.firstName">{{ invite.sender.firstName }} heeft jou uitgenodigd als beheerder van {{ invite.organization.name }}. Maak een account aan (of login) om toegang te krijgen tot alle inschrijvingen.</p>


                <STInputBox title="Naam" error-fields="firstName,lastName" :error-box="errorBox">
                    <div class="input-group">
                        <div>
                            <input v-model="firstName" class="input" type="text" placeholder="Voornaam" autocomplete="given-name">
                        </div>
                        <div>
                            <input v-model="lastName" class="input" type="text" placeholder="Achternaam" autocomplete="family-name">
                        </div>
                    </div>
                </STInputBox>

                <EmailInput title="E-mailadres" v-model="email" :validator="validator" placeholder="Vul jouw e-mailadres hier in" autocomplete="username"/>

                <STInputBox title="Kies een wachtwoord" error-fields="password" :error-box="errorBox">
                    <input v-model="password" class="input" placeholder="Kies een wachtwoord" autocomplete="new-password" type="password">
                </STInputBox>

                <STInputBox title="Herhaal wachtwoord" error-fields="passwordRepeat" :error-box="errorBox">
                    <input v-model="passwordRepeat" class="input" placeholder="Herhaal wachtwoord" autocomplete="new-password" type="password">
                </STInputBox>
            </template>

            <template v-else>
                <p class="st-list-description" v-if="invite.sender.firstName">{{ invite.sender.firstName }} heeft jou uitgenodigd als beheerder van {{ invite.organization.name }}.</p>

            </template>
        </main>

        <STFloatingFooter>
            <button class="button secundary" v-if="!loggedIn" @click="tryLogin" type="button">Ik heb al een account</button>
            <LoadingButton :loading="loading">
                <button class="button primary" v-if="!loggedIn">
                    <span class="icon lock" />
                    <span>Account aanmaken</span>
                </button>
                <button class="button primary" v-else>
                    <span class="icon success" />
                    <span>Uitnodiging accepteren</span>
                </button>
            </LoadingButton>
        </STFloatingFooter>
    </form>
</template>

<script lang="ts">
import { Decoder, StringDecoder, ObjectData, VersionBoxDecoder, ArrayDecoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties,NavigationMixin, NavigationController } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, LoadingButton, STFloatingFooter, STInputBox, STNavigationBar, ErrorBox, STErrorsDefault, Validator, EmailInput } from "@stamhoofd/components"
import { Sodium } from '@stamhoofd/crypto';
import { NetworkManager,Session, SessionManager, LoginHelper } from '@stamhoofd/networking';
import { ChallengeResponseStruct,KeyConstants,NewUser, OrganizationSimple, Token, User, Version, Invite, InviteKeychainItem, InviteUserDetails, KeychainItem, TradedInvite } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "vue-property-decorator";

import LoginView from '../login/LoginView.vue';
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';

@Component({
    components: {
        STNavigationBar,
        STFloatingFooter,
        STInputBox,
        LoadingButton,
        EmailInput,
        STErrorsDefault
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

                if (this.password.length < 14) {
                    throw new SimpleError({
                        code: "",
                        message: "Jouw wachtwoord moet uit minstens 14 karakters bestaan.",
                        field: "password"
                    })
                }

                if (!valid) {
                    this.loading = false 
                    this.errorBox = null
                    return;
                }

                const component = new ComponentWithProperties(CenteredMessage, { 
                    type: "loading",
                    title: "Account aanmaken...", 
                    description: "We maken gebruik van lange wiskundige berekeningen die jouw gegevens sterk beveiligen door middel van end-to-end encryptie. Dit duurt maar heel even."
                }).setDisplayStyle("overlay");
                this.present(component);

                if (!this.session) {
                    this.session = new Session(this.invite.organization.id)
                }

                await LoginHelper.signUp(this.session, this.email, this.password, this.firstName, this.lastName);
                (component.componentInstance() as any)?.pop()
            }

            // Trade in the key for the keychain constants + permissions (happens in the background
            await this.trade()
        } catch (e) {
            this.errorBox = new ErrorBox(e)
            console.error(e)
        }
       
        this.loading = false 
    }

    async trade() {
        const response = await this.session!.authenticatedServer.request({
            method: "POST",
            path: "/invite/"+encodeURIComponent(this.invite.key)+"/trade",
            decoder: TradedInvite as Decoder<TradedInvite>
        })

        // todo: store this result until completed the trade in!

        const encryptedKeychainItems = response.data.keychainItems
        
        if (encryptedKeychainItems) {
            const decrypted = await Sodium.decryptMessage(encryptedKeychainItems, this.secret)
            
            // unbox
            const keychainItems = new ObjectData(JSON.parse(decrypted), { version: Version }).decode(new VersionBoxDecoder(new ArrayDecoder(InviteKeychainItem as Decoder<InviteKeychainItem>))).data

            // Add the keys to the keychain (if not already present)
            const encryptedItems: KeychainItem[] = []
            for (const item of keychainItems) {
                const encryptedItem = await this.session!.createKeychainItem(item)
                encryptedItems.push(encryptedItem)
            }

            if (encryptedItems.length > 0) {
                const response = await this.session!.authenticatedServer.request({
                    method: "POST",
                    path: "/keychain",
                    body: encryptedItems
                })
            }
        }

        // Clear user since permissions have changed
        this.session!.user = null;
        SessionManager.clearCurrentSession()
        await SessionManager.setCurrentSession(this.session!)
        this.dismiss({ force: true })
    }
}
</script>

<style lang="scss">

</style>