<template>
    <form id="signup-account-view" class="st-view" @submit.prevent="goNext">
        <STNavigationBar title="Maak jouw account">
            <BackButton v-if="canPop" slot="left" @click="pop" />
        </STNavigationBar>

        <main>
            <h1>
                Maak jouw account
            </h1>
            <p>
                Je kan later nog andere beheerders toevoegen, dus kies een persoonlijk e-mailadres en wachtwoord dat niet gedeeld wordt.
            </p>

            <STErrorsDefault :error-box="errorBox" />

            <div class="split-inputs">
                <div>
                    <EmailInput v-model="email" title="Persoonlijk e-mailadres" :validator="validator" placeholder="Vul jouw e-mailadres hier in" autocomplete="username" />
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
                    <STInputBox title="Kies een persoonlijk wachtwoord" error-fields="password" :error-box="errorBox">
                        <input v-model="password" class="input" placeholder="Kies een wachtwoord" autocomplete="new-password" type="password">
                    </STInputBox>
                    <STInputBox title="Herhaal wachtwoord" error-fields="passwordRepeat" :error-box="errorBox">
                        <input v-model="passwordRepeat" class="input" placeholder="Herhaal nieuw wachtwoord" autocomplete="new-password" type="password">
                    </STInputBox>
                </div>

                <div>
                    <PasswordStrength v-model="password" />
                </div>
            </div>


            <div class="checkbox-box">
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
        </main>

        <STToolbar :sticky="false">
            <template #left>
                Het aanmaken van de verenging kan een tiental seconden duren afhankelijk van de rekenkracht van jouw toestel.
            </template>
            <template #right>
                <LoadingButton :loading="loading">
                    <button class="button primary" @click.prevent="goNext">
                        Account aanmaken
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </form>
</template>

<script lang="ts">
import { isSimpleError, isSimpleErrors, SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, CenteredMessage,Checkbox,ConfirmEmailView,EmailInput, ErrorBox, LoadingButton, PasswordStrength, STErrorsDefault, STInputBox, STNavigationBar, STToolbar, Validator } from "@stamhoofd/components"
import { LoginHelper, Session } from "@stamhoofd/networking"
import { Organization } from '@stamhoofd/structures';
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
        Checkbox,
        PasswordStrength
    }
})
export default class SignupAccountView extends Mixins(NavigationMixin) {
    @Prop({required: true})
    organization: Organization

    @Prop({required: true})
    registerCode: { code: string; organization: string } | null;

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

            if (this.password.length < 8) {
                plausible('passwordTooShort'); // track how many people try to create a sorter one (to reevaluate this restriction)
                throw new SimpleError({
                    code: "password_too_short",
                    message: "Jouw wachtwoord moet uit minstens 8 karakters bestaan.",
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
        
            const component = new CenteredMessage("Sleutels aanmaken...", "We maken gebruik van lange wiskundige berekeningen die alle gegevens sterk beveiligen door middel van end-to-end encryptie. Dit duurt maar heel even.", "loading").show()
            plausible('signupKeys');
            try {

                const token = await LoginHelper.signUpOrganization(this.organization, this.email, this.password, this.firstName, this.lastName, this.registerCode?.code)
                plausible('signup');

                this.loading = false;
                component.hide()

                const session = new Session(this.organization.id)
                this.show(new ComponentWithProperties(ConfirmEmailView, { token, session }))
                
            } catch (e) {
                this.loading = false;
                component.hide()

                if (isSimpleError(e) || isSimpleErrors(e)) {
                    // Show normal errors
                    throw e;
                }

                plausible('signupAccountKeyError');

                new CenteredMessage("Er ging iets mis", "Het is niet gelukt om de sleutels aan te maken. Probeer het op een ander toestel of browser opnieuw uit of neem contact met ons op.", "error").addCloseButton().show()
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
    .checkbox-box {
        margin-top: 15px;
    }
}
</style>
