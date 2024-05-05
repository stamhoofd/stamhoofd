<template>
    <form id="signup-account-view" class="st-view" @submit.prevent="goNext">
        <STNavigationBar title="Maak jouw account" />

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
                    <EmailInput v-model="email" title="Persoonlijk e-mailadres" name="username" :validator="validator" placeholder="Vul jouw e-mailadres hier in" autocomplete="username" />
                </div>

                <div>
                    <STInputBox title="Jouw naam" error-fields="firstName,lastName" :error-box="errorBox">
                        <div class="input-group">
                            <div>
                                <input v-model="firstName" name="given-name" class="input" type="text" placeholder="Voornaam" autocomplete="given-name">
                            </div>
                            <div>
                                <input v-model="lastName" name="family-name" class="input" type="text" placeholder="Achternaam" autocomplete="family-name">
                            </div>
                        </div>
                    </STInputBox>
                </div>
            </div>

            <div class="split-inputs">
                <div>
                    <STInputBox title="Kies een persoonlijk wachtwoord" error-fields="password" :error-box="errorBox">
                        <input v-model="password" name="new-password" class="input" placeholder="Kies een wachtwoord" autocomplete="new-password" type="password" @input="password = $event.target.value" @change="password = $event.target.value">
                    </STInputBox>
                    <STInputBox title="Herhaal wachtwoord" error-fields="passwordRepeat" :error-box="errorBox">
                        <input v-model="passwordRepeat" name="repeat-new-password" class="input" placeholder="Herhaal nieuw wachtwoord" autocomplete="new-password" type="password" @input="passwordRepeat = $event.target.value" @change="passwordRepeat = $event.target.value">
                    </STInputBox>
                </div>

                <div>
                    <PasswordStrength v-model="password" />
                </div>
            </div>


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
        </main>

        <STToolbar>
            <template #right>
                <LoadingButton :loading="loading">
                    <button class="button primary" type="button" @click.prevent="goNext">
                        Account aanmaken
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </form>
</template>

<script lang="ts">
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, HistoryManager, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";
import { BackButton, Checkbox, ConfirmEmailView, EmailInput, ErrorBox, LoadingButton, PasswordStrength, STErrorsDefault, STInputBox, STNavigationBar, STToolbar, Validator } from "@stamhoofd/components";
import { LoginHelper, Session, Storage } from "@stamhoofd/networking";
import { Organization } from '@stamhoofd/structures';
import { getScopedDashboardRoot } from '../../getRootViews';

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

            if (this.password != this.passwordRepeat) {
                plausible('passwordsNotMatching'); // track how many people try to create a sorter one (to reevaluate this restriction)
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
            plausible('signup');

            this.loading = false;

            const session = new Session(this.organization.id)
            await prepareSessionForUsage(session, true);
            const dashboardContext = getScopedDashboardRoot(session, {
                loginComponents: [
                    new ComponentWithProperties(ConfirmEmailView, { token, email: this.email })
                ]
            })
            
            this.present({
                components: [
                    dashboardContext
                ],
                animated: true,
                replace: 1,
                invalidHistory: true // Going back should now reload the full page
            })

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
