<template>
    <div class="login-view">
       <h1>Inloggen</h1>

        <STInputBox title="E-mailadres">
            <input v-model="email" class="input" placeholder="Vul jouw e-mailadres hier in" autocomplete="username" type="email">
        </STInputBox>

        <STInputBox title="Wachtwoord">
            <button slot="right" class="button text" type="button" @click="gotoPasswordForgot">
                <span>Vergeten</span>
                <span class="icon help"/>
            </button>
            <input v-model="password" class="input" placeholder="Vul jouw wachtwoord hier in" autocomplete="current-password" type="password">
        </STInputBox>

        <STFloatingFooter>
            <Spinner v-if="loading" />
            <button class="button primary full" @click="submit">
                <span class="lock" />
                Inloggen
            </button>
        </STFloatingFooter>
    </div>
</template>

<script lang="ts">
import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties,NavigationController,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { NetworkManager, SessionManager } from '@stamhoofd/networking';
import { Component, Mixins } from "vue-property-decorator";
import AuthEncryptionKeyWorker from 'worker-loader!@stamhoofd/workers/LoginAuthEncryptionKey.ts';
import SignKeysWorker from 'worker-loader!@stamhoofd/workers/LoginSignKeys.ts';
import { ChallengeResponseStruct,KeyConstants,NewUser, OrganizationSimple, Token, User, Version } from '@stamhoofd/structures';
import { CenteredMessage, Spinner, STFloatingFooter, STInputBox, STNavigationBar } from "@stamhoofd/components"
import { Sodium } from '@stamhoofd/crypto';

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
        Spinner
    }
})
export default class LoginView extends Mixins(NavigationMixin){
    loading = false;
    email = ""
    password = ""

    session = SessionManager.currentSession!

    gotoPasswordForgot() {
       // this.show(new ComponentWithProperties(ForgotPasswordView, {}))
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
    @use "~@stamhoofd/scss/base/variables.scss" as *;
    @use "~@stamhoofd/scss/base/text-styles.scss" as *;

    .login-view {
        padding: 20px;
        padding-top: 100px;

        max-width: 400px;
        margin: 0 auto;

        > h1 {
            @extend .style-huge-title-1;
            padding-bottom: 10px;
        }

        > p {
            @extend .style-description;
            padding-bottom: 10px;
        }

        > input.search {
            max-width: none;
        }

        > .spinner-container {
            padding: 10px 0;
        }

        > .search-result {
            @extend .style-input-shadow;
            background: $color-white url('~@stamhoofd/assets/images/icons/gray/arrow-right-small.svg') right 10px center no-repeat;
            border: $border-width solid $color-gray-light;
            padding: 20px 20px;
            border-radius: $border-radius;
            margin: 10px 0;
            transition: transform 0.2s, border-color 0.2s;
            cursor: pointer;
            touch-action: manipulation;
            user-select: none;
            display: block;
            width: 100%;
            text-align: left;

            > h1 {
                @extend .style-title-3;
                padding-bottom: 2px;
            }

            > p {
                @extend .style-description;
            }

            &:hover {
                border-color: $color-primary-gray-light;
            }


            &:active {
                transform: scale(0.95, 0.95);
                border-color: $color-primary;
            }
        }
    }
</style>
