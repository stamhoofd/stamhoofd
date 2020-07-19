<template>
    <form id="signup-account-view" class="st-view" @submit.prevent="goNext">
        <STNavigationBar title="Maak jouw account">
            <BackButton slot="left" v-if="canPop" @click="pop"/>
        </STNavigationBar>

        <main>
            <h1>
                Maak jouw account
            </h1>
            <p>
                Alle gegevens van jouw leden worden in een versleutelde digitale kluis bijgehouden - ook Stamhoofd heeft hier geen toegang tot. Het is belangrijk dat je de toegang tot die kluis goed beschermd met sterke wachtwoorden. Doe dit om de gegevens van jouw leden te beschermen, het is jouw plicht om hun persoonsgegevens te beschermen.
            </p>

            <STErrorsDefault :error-box="errorBox" />

            <div class="split-inputs">
                <div>
                    <STInputBox title="E-mailadres">
                        <input v-model="email" class="input" placeholder="Vul jouw e-mailadres hier in" autocomplete="username" type="email">
                    </STInputBox>

                    <STInputBox title="Kies een wachtwoord">
                        <input v-model="password" class="input" placeholder="Kies een nieuw wachtwoord" autocomplete="new-password" type="password">
                    </STInputBox>

                    <STInputBox title="Herhaal wachtwoord">
                        <input v-model="passwordRepeat" class="input" placeholder="Kies een nieuw wachtwoord" autocomplete="new-password" type="password">
                    </STInputBox>
                </div>

                <div>
                    <div class="warning-box">
                        Kies een wachtwoord van minstens 14 karakters. We raden je heel sterk aan om een wachtwoordbeheerder te gebruiken en een wachtwoord te kiezen dat nog veel langer is (en automatisch gegenereerd).
                    </div>
                </div>
            </div>
        </main>

        <STToolbar>
            <template #left>
                Het aanmaken van de verenging kan een tiental seconden duren afhankelijk van de rekenkracht van jouw toestel.
            </template>
            <template #right>
                <Spinner v-if="loading" />
                <button class="button primary">
                    Volgende
                </button>
            </template>
        </STToolbar>
    </form>
</template>

<script lang="ts">
import { ObjectData } from '@simonbackx/simple-encoding';
import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { Server } from "@simonbackx/simple-networking";
import { ComponentWithProperties,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage,ErrorBox, Spinner,STErrorsDefault, STInputBox, STNavigationBar, STToolbar, BackButton } from "@stamhoofd/components"
import { KeyConstantsHelper, SensitivityLevel, Sodium } from "@stamhoofd/crypto"
import { NetworkManager, Session, SessionManager } from "@stamhoofd/networking"
import { CreateOrganization,KeychainItem,KeyConstants, NewUser, Organization,Token, Version } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "vue-property-decorator";
import GenerateWorker from 'worker-loader!@stamhoofd/workers/generateAuthKeys.ts';

@Component({
    components: {
        STToolbar,
        STNavigationBar,
        STErrorsDefault,
        STInputBox,
        Spinner,
        BackButton
    }
})
export default class SignupAccountView extends Mixins(NavigationMixin) {
    @Prop({required: true})
    organization: Organization
    errorBox: ErrorBox | null = null

    password = ""
    passwordRepeat = ""
    email = ""

    loading = false

    async goNext() {
        if (this.loading) {
            return
        }

        try {
            // todo: validate details

            // Generate keys
            this.loading = true
            this.errorBox = null

            const myWorker = new GenerateWorker();
            const component = new ComponentWithProperties(CenteredMessage, { 
                type: "loading",
                title: "Sleutels aanmaken...", 
                description: "Dit duurt maar heel even. Met deze sleutels wordt jouw account beveiligd. De lange wiskundige berekeningen zorgen ervoor dat het voor hackers lang duurt om een mogelijk wachtwoord uit te proberen."
            }).setDisplayStyle("overlay");

            myWorker.onmessage = async (e) => {
                const {
                    userKeyPair,
                    organizationKeyPair,
                    authSignKeyPair,
                    authEncryptionSecretKey
                } = e.data;

                const authSignKeyConstantsEncoded = e.data.authSignKeyConstants;
                const authEncryptionKeyConstantsEncoded = e.data.authEncryptionKeyConstants;

                console.log(e.data)

                const authSignKeyConstants = KeyConstants.decode(new ObjectData(authSignKeyConstantsEncoded, {version: Version}))
                const authEncryptionKeyConstants = KeyConstants.decode(new ObjectData(authEncryptionKeyConstantsEncoded, {version: Version}))
                
                console.info(e)
                // todo
                console.log('Message received from worker');
                myWorker.terminate();
                (component.componentInstance() as any)?.pop()

                const user =  NewUser.create({
                    email: this.email,
                    publicKey: userKeyPair.publicKey,
                    publicAuthSignKey: authSignKeyPair.publicKey,
                    authSignKeyConstants,
                    authEncryptionKeyConstants,
                    encryptedPrivateKey: await Sodium.encryptMessage(userKeyPair.privateKey, authEncryptionSecretKey)
                });

                const organization = this.organization
                organization.publicKey = organizationKeyPair.publicKey

                // Do netwowrk request to create organization
                const response = await NetworkManager.server.request({
                    method: "POST",
                    path: "/organizations",
                    body: CreateOrganization.create({
                        organization: this.organization,
                        user,
                        keychainItems: [
                            KeychainItem.create({
                                publicKey: organization.publicKey,
                                encryptedPrivateKey: await Sodium.sealMessageAuthenticated(organizationKeyPair.privateKey, userKeyPair.publicKey, userKeyPair.privateKey)
                            })
                        ]
                    }),
                    decoder: Token
                })

                const session = new Session(organization.id)
                session.organization = organization
                session.setToken(response.data)
                session.setEncryptionKey(authEncryptionSecretKey, {user, userPrivateKey: userKeyPair.privateKey, organizationPrivateKey: organizationKeyPair.privateKeyPair})
                SessionManager.setCurrentSession(session)

                this.loading = false;
            }

             myWorker.onerror = (e) => {
                // todo
                console.error(e);
                myWorker.terminate();
                this.loading = false;
                (component.componentInstance() as any)?.pop()

                const errorMessage = new ComponentWithProperties(CenteredMessage, { 
                    type: "error",
                    title: "Er ging iets mis", 
                    description: "Het is niet gelukt om de sleutels aan te maken. Probeer het op een ander toestel of browser opnieuw uit of neem contact met ons op.",
                    closeButton: "Sluiten",
                }).setDisplayStyle("overlay");
                this.present(errorMessage)
            }

            myWorker.postMessage(this.password);
            this.present(component)

        } catch (e) {
            console.error(e)
            if (isSimpleError(e) || isSimpleErrors(e)) {
                console.log("Updated errorbox")
                this.errorBox = new ErrorBox(e)
            }
            return;
        }
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

#signup-account-view {
}
</style>
