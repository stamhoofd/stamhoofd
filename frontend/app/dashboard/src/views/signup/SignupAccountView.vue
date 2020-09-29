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
                        <input v-model="passwordRepeat" class="input" placeholder="Herhaal nieuw wachtwoord" autocomplete="new-password" type="password">
                    </STInputBox>

                    <Checkbox v-model="acceptPrivacy" class="long-text">
                        Ik heb kennis genomen van <a class="inline-link" href="https://voorwaarden.stamhoofd.be/privacy" target="_blank">het privacybeleid</a>.
                    </Checkbox>

                    <Checkbox v-model="acceptTerms" class="long-text">
                        Ik heb <a class="inline-link" href="https://voorwaarden.stamhoofd.be/algemene-voorwaarden" target="_blank">de algemene voorwaarden</a> gelezen en ga hiermee akkoord in naam van mijn vereniging.
                    </Checkbox>

                    <Checkbox v-model="acceptDataAgreement" class="long-text">
                        Ik <a class="inline-link" href="https://voorwaarden.stamhoofd.be/verwerkersovereenkomst" target="_blank">de verwerkersovereenkomst</a> gelezen en ga hiermee akkoord in naam van mijn vereniging.
                    </Checkbox>
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
                <LoadingButton :loading="loading" >
                    <button class="button primary">
                        Account aanmaken
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </form>
</template>

<script lang="ts">
import { ObjectData } from '@simonbackx/simple-encoding';
import { isSimpleError, isSimpleErrors, SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { Server } from "@simonbackx/simple-networking";
import { ComponentWithProperties,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage,ErrorBox, LoadingButton, STErrorsDefault, STInputBox, STNavigationBar, STToolbar, BackButton, EmailInput, Validator, Checkbox } from "@stamhoofd/components"
import { KeyConstantsHelper, SensitivityLevel, Sodium } from "@stamhoofd/crypto"
import { NetworkManager, Session, SessionManager, Keychain, LoginHelper } from "@stamhoofd/networking"
import { CreateOrganization,KeychainItem,KeyConstants, NewUser, Organization,Token, Version } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "vue-property-decorator";

@Component({
    components: {
        STToolbar,
        STNavigationBar,
        STErrorsDefault,
        STInputBox,
        LoadingButton,
        BackButton,
        EmailInput,
        Checkbox
    }
})
export default class SignupAccountView extends Mixins(NavigationMixin) {
    @Prop({required: true})
    organization: Organization

    @Prop({required: true})
    registerCode: string | null;

    errorBox: ErrorBox | null = null
    validator = new Validator()

    password = ""
    passwordRepeat = ""
    email = ""
    firstName = ""
    lastName = ""

    loading = false
    acceptPrivacy = false
    acceptTerms = false
    acceptDataAgreement = false

    async goNext() {
        if (this.loading) {
            return
        }

        try {
            // todo: validate details

            // Generate keys
            this.loading = true
            this.errorBox = null

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
                    code: "password_do_not_match",
                    message: "De ingevoerde wachtwoorden komen niet overeen",
                    field: "passwordRepeat"
                })
            }

            if (this.password.length < 14) {
                plausible('passwordTooShort'); // track how many people try to create a sorter one (to reevaluate this restriction)
                throw new SimpleError({
                    code: "password_too_short",
                    message: "Jouw wachtwoord moet uit minstens 14 karakters bestaan.",
                    field: "password"
                })
            }

            if (!this.acceptPrivacy) {
                throw new SimpleError({
                    code: "read_privacy",
                    message: "Je moet kennis hebben genomen van het privacybeleid voor je een account kan aanmaken."
                })
                return;
            }

            if (!this.acceptTerms) {
                throw new SimpleError({
                    code: "read_privacy",
                    message: "Je moet akkoord gaan met de algemene voorwaarden voor je een account kan aanmaken."
                })
                return;
            }

            if (!this.acceptDataAgreement) {
                throw new SimpleError({
                    code: "read_privacy",
                    message: "Je moet akkoord gaan met de verwerkersovereenkomst voor je een account kan aanmaken."
                })
                return;
            }

            if (!valid) {
                this.loading = false 
                this.errorBox = null
                return;
            }

            const component = new ComponentWithProperties(CenteredMessage, { 
                type: "loading",
                title: "Sleutels aanmaken...", 
                description: "Dit duurt maar heel even. Met deze sleutels wordt jouw account beveiligd. De lange wiskundige berekeningen zorgen ervoor dat het voor hackers lang duurt om een mogelijk wachtwoord uit te proberen."
            }).setDisplayStyle("overlay");
            this.present(component)

            try {

                await LoginHelper.signUpOrganization(this.organization, this.email, this.password, this.firstName, this.lastName, this.registerCode)
                
                this.loading = false;
                (component.componentInstance() as any)?.pop()
                this.dismiss({ force: true });
                plausible('signup');

            } catch (e) {
                this.loading = false;
                (component.componentInstance() as any)?.pop();

                if (isSimpleError(e) || isSimpleErrors(e)) {
                    // Show normal errors
                    throw e;
                }

                plausible('signupAccountKeyError');
                const errorMessage = new ComponentWithProperties(CenteredMessage, { 
                    type: "error",
                    title: "Er ging iets mis", 
                    description: "Het is niet gelukt om de sleutels aan te maken. Probeer het op een ander toestel of browser opnieuw uit of neem contact met ons op.",
                    closeButton: "Sluiten",
                }).setDisplayStyle("overlay");
                this.present(errorMessage)
                return;
            }
        } catch (e) {
            this.loading = false
            console.error(e)
            this.errorBox = new ErrorBox(e)
            plausible('signupAccountError');
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
