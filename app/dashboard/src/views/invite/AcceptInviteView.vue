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


                <STInputBox title="E-mailadres">
                    <input v-model="email" class="input" placeholder="Vul jouw e-mailadres hier in" autocomplete="username" type="email">
                </STInputBox>

                <STInputBox title="Kies een wachtwoord">
                    <input v-model="password" class="input" placeholder="Kies een nieuw wachtwoord" autocomplete="new-password" type="password">
                </STInputBox>

                <STInputBox title="Herhaal wachtwoord">
                    <input v-model="passwordRepeat" class="input" placeholder="Kies een nieuw wachtwoord" autocomplete="new-password" type="password">
                </STInputBox>
            </template>

            <template v-else>
                <p class="st-list-description" v-if="invite.sender.firstName">{{ invite.sender.firstName }} heeft jou uitgenodigd als beheerder van {{ invite.organization.name }}.</p>

            </template>
        </main>

        <STFloatingFooter>
            <button class="button secundary" v-if="!loggedIn" @click="tryLogin">Ik heb al een account</button>
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
import { CenteredMessage, LoadingButton, STFloatingFooter, STInputBox, STNavigationBar, ErrorBox, STErrorsDefault } from "@stamhoofd/components"
import { Sodium } from '@stamhoofd/crypto';
import { NetworkManager,Session, SessionManager, LoginHelper } from '@stamhoofd/networking';
import { ChallengeResponseStruct,KeyConstants,NewUser, OrganizationSimple, Token, User, Version, Invite, InviteKeychainItem, InviteUserDetails, KeychainItem, TradedInvite } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "vue-property-decorator";
import AuthEncryptionKeyWorker from 'worker-loader!@stamhoofd/workers/LoginAuthEncryptionKey.ts';
import SignKeysWorker from 'worker-loader!@stamhoofd/workers/LoginSignKeys.ts';

import ForgotPasswordView from './ForgotPasswordView.vue';
import LoginView from '../login/LoginView.vue';

@Component({
    components: {
        STNavigationBar,
        STFloatingFooter,
        STInputBox,
        LoadingButton,
        STErrorsDefault
    }
})
export default class AcceptInviteView extends Mixins(NavigationMixin){
    @Prop({ required: true})
    invite!: Invite    

    @Prop({ required: true})
    secret!: string 

    loading = false

    email = this.invite.userDetails?.email ?? ""
    password = ""
    passwordRepeat = ""
    errorBox: ErrorBox | null = null
    session: Session | null = SessionManager.getSessionForOrganization(this.invite.organization.id) ?? null
    loggedIn = false

    mounted() {
        console.log(this.invite)
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

    get firstName() {
        return this.invite.receiver?.firstName ?? this.invite?.userDetails?.firstName ?? "?"
    }

    tryLogin() {
        const session = SessionManager.getSessionForOrganization(this.invite.organization.id)
        if (session && session.canGetCompleted()) {
            SessionManager.setCurrentSession(session)
            return
        }
        this.present(new ComponentWithProperties(NavigationController, { root: new ComponentWithProperties(LoginView, { organization: this.invite.organization }) }).setDisplayStyle("sheet"))
    }

    async submit() {
        if (this.loading) {
            return
        }
        this.loading = true

        try {
            // Trade in the key for the keychain constants + permissions (happens in the background)

            // First need to create an account in this organization (required)

            if (this.loggedIn) {
                // No need to create an account
                await this.trade()
            }
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
        
        SessionManager.setCurrentSession(this.session!)
        this.dismiss({ force: true })
    }
}
</script>

<style lang="scss">

</style>