<template>
    <form id="signup-account-view" class="st-view" @submit.prevent="goNext">
        <STNavigationBar title="Jouw account" :dismiss="false" :pop="canPop || canDismiss" />

        <main class="center small">
            <aside class="style-title-prefix">
                STAP 2 / 2
            </aside>
            <h1>
                Jouw account
            </h1>
            <p>
                Je kan later nog andere beheerders toevoegen, dus kies een persoonlijk e-mailadres en wachtwoord dat niet gedeeld wordt.
            </p>

            <STErrorsDefault :error-box="errorBox" />


            <STInputBox title="Jouw naam" error-fields="firstName,lastName" :error-box="errorBox" class="max">
                <div class="input-group">
                    <div>
                        <input v-model="firstName" enterkeyhint="next" name="given-name" class="input" type="text" placeholder="Voornaam" autocomplete="given-name">
                    </div>
                    <div>
                        <input v-model="lastName" enterkeyhint="next" name="family-name" class="input" type="text" placeholder="Achternaam" autocomplete="family-name">
                    </div>
                </div>
            </STInputBox>
            <EmailInput v-model="email" enterkeyhint="next" class="max" title="E-mailadres" name="username" :validator="validator" placeholder="Vul jouw e-mailadres hier in" autocomplete="username" />
                
            <PasswordInput v-model="password" enterkeyhint="next" class="max" title="Wachtwoord" name="new-password" :validator="validator" placeholder="Kies een wachtwoord" autocomplete="new-password" />

            <div class="checkbox-box">
                <Checkbox v-model="acceptPrivacy" class="long-text">
                    Ik heb kennis genomen van <a class="inline-link" :href="'https://'+$t('shared.domains.marketing')+'/terms/privacy'" target="_blank">het privacybeleid</a>.
                </Checkbox>

                <Checkbox v-model="acceptTerms" class="long-text">
                    Ik heb <a class="inline-link" :href="'https://'+$t('shared.domains.marketing')+'/terms/algemene-voorwaarden'" target="_blank">de algemene voorwaarden</a> gelezen en ga hiermee akkoord in naam van mijn vereniging.
                </Checkbox>

                <Checkbox v-model="acceptDataAgreement" class="long-text">
                    Ik heb <a class="inline-link" :href="'https://'+$t('shared.domains.marketing')+'/terms/verwerkersovereenkomst'" target="_blank">de verwerkersovereenkomst</a> gelezen en ga hiermee akkoord in naam van mijn vereniging.
                </Checkbox>
            </div>

            <hr>

            <div class="style-button-bar">
                <LoadingButton slot="right" :loading="loading" class="max">
                    <button class="button primary" type="button" @click.prevent="goNext">
                        <span>Voltooien</span>
                        <span class="icon arrow-right" />
                    </button>
                </LoadingButton>
            </div>
        </main>
    </form>
</template>

<script lang="ts">
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { PasswordInput } from '@stamhoofd/components';
import { BackButton, Checkbox,ConfirmEmailView,EmailInput, ErrorBox, LoadingButton, PasswordStrength, STErrorsDefault, STInputBox, STNavigationBar, STToolbar, Validator } from "@stamhoofd/components"
import { LoginHelper, Session, SessionManager, Storage } from "@stamhoofd/networking"
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
        PasswordStrength,
        PasswordInput
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
            // TODO: validate details

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

            if (this.password.length < 8) {
                plausible('passwordTooShort'); // track how many people try to create a sorter one (to reevaluate this restriction)
                throw new SimpleError({
                    code: "password_too_short",
                    message: "Jouw wachtwoord moet uit minstens 8 karakters bestaan.",
                    field: "password"
                })
            }

            if (!this.acceptPrivacy) {
                plausible('termsNotAccepted'); // track how many people try to create a sorter one (to reevaluate this restriction)
                throw new SimpleError({
                    code: "read_privacy",
                    message: "Je moet kennis hebben genomen van het privacybeleid voor je een account kan aanmaken."
                })
            }

            if (!this.acceptTerms) {
                plausible('termsNotAccepted');
                throw new SimpleError({
                    code: "read_privacy",
                    message: "Je moet akkoord gaan met de algemene voorwaarden voor je een account kan aanmaken."
                })
            }

            if (!this.acceptDataAgreement) {
                plausible('termsNotAccepted');
                throw new SimpleError({
                    code: "read_privacy",
                    message: "Je moet akkoord gaan met de verwerkersovereenkomst voor je een account kan aanmaken."
                })
            }
            this.organization.meta.lastSignedTerms = new Date()

            if (!valid) {
                this.loading = false 
                this.errorBox = null
                return;
            }
        
            const token = await LoginHelper.signUpOrganization(this.organization, this.email, this.password, this.firstName, this.lastName, this.registerCode?.code)
            try {
                plausible('signup');
            } catch (e) {
                console.error(e)
            }

            this.loading = false;

            try {
                await SessionManager.addOrganizationToStorage(this.organization)
            } catch (e) {
                console.error("Failed to add organization to storage", e)
            }

            const session = new Session(this.organization.id)
            this.show(new ComponentWithProperties(ConfirmEmailView, { token, session, email: this.email }))

            try {
                Storage.keyValue.removeItem("savedRegisterCode").catch(console.error)
                Storage.keyValue.removeItem("savedRegisterCodeDate").catch(console.error)
            } catch (e) {
                console.error(e)
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
#signup-account-view {
    .checkbox-box {
        margin-top: 15px;
    }
}
</style>
