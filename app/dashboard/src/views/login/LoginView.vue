<template>
    <form class="auto st-view login-view" @submit.prevent="submit">
        <STNavigationBar title="Inloggen">
            <button slot="right" type="button" class="button close" @click="dismiss" />
        </STNavigationBar>
        <main>
            <h1>Inloggen</h1>
            <p>Vraag je mede leiding om je toe te voegen als beheerder als je nog geen account hebt.</p>

            <STInputBox title="E-mailadres">
                <input v-model="email" class="input" placeholder="Vul jouw e-mailadres hier in" autocomplete="username" type="email">
            </STInputBox>

            <STInputBox title="Wachtwoord">
                <button slot="right" class="button icon right gray help" type="button" @click="gotoPasswordForgot">
                    Vergeten
                </button>
                <input v-model="password" class="input" placeholder="Vul jouw wachtwoord hier in" autocomplete="current-password" type="password">
            </STInputBox>
        </main>

        <STFloatingFooter>
            <Spinner v-if="loading" />
            <button class="button primary full">
                <span class="lock" />
                Inloggen
            </button>
        </STFloatingFooter>
    </form>
</template>

<script lang="ts">
import { Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Spinner, STFloatingFooter, STInputBox, STNavigationBar } from "@stamhoofd/components"
import { Sodium } from '@stamhoofd/crypto';
import { NetworkManager,Session, SessionManager } from '@stamhoofd/networking';
import { ChallengeResponseStruct,KeyConstants,NewUser,Organization, Token, User, Version } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "vue-property-decorator";
import AuthEncryptionKeyWorker from 'worker-loader!@stamhoofd/workers/LoginAuthEncryptionKey.ts';
import SignKeysWorker from 'worker-loader!@stamhoofd/workers/LoginSignKeys.ts';

import ForgotPasswordView from './ForgotPasswordView.vue';

@Component({
    components: {
        STNavigationBar,
        STFloatingFooter,
        STInputBox,
        Spinner
    }
})
export default class LoginView extends Mixins(NavigationMixin){
    @Prop({ required: true})
    organization: Organization
    session!: Session
    loading = false

    email = ""
    password = ""

    mounted() {
        // Search for the session
        this.session = SessionManager.getSessionForOrganization(this.organization.id) ?? new Session(this.organization)
        this.email = this.session.user?.email ?? ""
    }

    gotoPasswordForgot() {
        this.show(new ComponentWithProperties(ForgotPasswordView, {}))
    }

    async createSignKeys(password: string, authSignKeyConstants: KeyConstants): Promise<{ publicKey: string; privateKey: string }> {
        return new Promise((resolve, reject) => {
            const myWorker = new SignKeysWorker();

            myWorker.onmessage = (e) => {
                const authSignKeys = e.data
                
                // Requset challenge
                myWorker.terminate()
                resolve(authSignKeys)
            }

             myWorker.onerror = (e) => {
                // todo
                console.error(e);
                myWorker.terminate();
                reject(e)
            }

            myWorker.postMessage({
                password,
                authSignKeyConstants: authSignKeyConstants.encode({ version: Version })
            });
        })
    }

    async createEncryptionKey(password: string, authEncryptionKeyConstants: KeyConstants): Promise<string> {
        return new Promise((resolve, reject) => {
            console.log("starting encryption key worker")
            const myWorker = new AuthEncryptionKeyWorker();

            myWorker.onmessage = (e) => {
                const key = e.data
                
                // Requset challenge
                myWorker.terminate()
                resolve(key)
            }

             myWorker.onerror = (e) => {
                // todo
                console.error(e);
                myWorker.terminate();
                reject(e)
            }

            myWorker.postMessage({
                password,
                authEncryptionKeyConstants: authEncryptionKeyConstants.encode({ version: Version })
            });
        })
    }

     

    async submit() {
        if (this.loading) {
            return
        }

        this.loading = true
        // Request the key constants

        let challengeResponse: ChallengeResponseStruct
        try {
            const response = await this.session.server.request({
                method: "POST",
                path: "/oauth/token",
                // eslint-disable-next-line @typescript-eslint/camelcase
                body: {grant_type: "request_challenge", email: this.email },
                decoder: ChallengeResponseStruct as Decoder<ChallengeResponseStruct>
            })
            challengeResponse = response.data

        } catch (e) {
            console.error(e)
            this.loading = false;
            const errorMessage = new ComponentWithProperties(CenteredMessage, { 
                type: "error",
                title: "Er ging iets mis", 
                description: "Het is niet gelukt om te verbinden met de server. Probeer het opnieuw.",
                closeButton: "Sluiten",
            }).setDisplayStyle("overlay");
            this.present(errorMessage)
            return;
        }
        
        const component = new ComponentWithProperties(CenteredMessage, { 
            type: "loading",
            title: "Sleutels aanmaken...", 
            description: "Dit duurt maar heel even. Met deze sleutels wordt jouw account beveiligd. De lange wiskundige berekeningen zorgen ervoor dat het voor hackers lang duurt om een mogelijk wachtwoord uit te proberen."
        }).setDisplayStyle("overlay");
        this.present(component)

        let authSignKeys: { publicKey: string; privateKey: string }
        try {
            authSignKeys = await this.createSignKeys(this.password, challengeResponse.keyConstants)
        } catch (e) {
            this.loading = false;
            (component.componentInstance() as any)?.pop()

            const errorMessage = new ComponentWithProperties(CenteredMessage, { 
                type: "error",
                title: "Er ging iets mis", 
                description: "Het is niet gelukt om de sleutels aan te maken. Probeer het op een ander toestel of browser opnieuw uit of neem contact met ons op.",
                closeButton: "Sluiten",
            }).setDisplayStyle("overlay");
            this.present(errorMessage)
            return;
        }
        (component.componentInstance() as any)?.pop()

        try {
            if (challengeResponse.challenge.length < 30) {
                throw new Error("Malicious challenge received")
            }
            console.log("Signing challenge...")
            console.log(challengeResponse)
            console.log(authSignKeys)
            const signature = await Sodium.signMessage(challengeResponse.challenge, authSignKeys.privateKey)
            console.log("Sending signature...")
            const response = await this.session.server.request({
                method: "POST",
                path: "/oauth/token",
                // eslint-disable-next-line @typescript-eslint/camelcase
                body: {grant_type: "challenge", email: this.email, challenge: challengeResponse.challenge, signature },
                decoder: Token as Decoder<Token>
            })
            console.log("Set token")
            this.session.setToken(response.data)

            // Request additional data
            console.log("Fetching user")
            const user = await this.session.fetchUser()
            console.log("ok")
            const encryptionKey = await this.createEncryptionKey(this.password, user.authEncryptionKeyConstants)
            this.session.setEncryptionKey(encryptionKey)
            
            SessionManager.setCurrentSession(this.session)
            this.pop()
        } catch (e) {
            console.error(e)
            this.loading = false;
            const errorMessage = new ComponentWithProperties(CenteredMessage, { 
                type: "error",
                title: "Foutief wachtwoord of e-mailadres", 
                description: "Kijk na of je geen typfout hebt gemaakt en probeer het opnieuw",
                closeButton: "Sluiten",
            }).setDisplayStyle("overlay");
            this.present(errorMessage)
            return;
        }


    }
    
}
</script>

<style lang="scss">
    .login-view {
    }
</style>