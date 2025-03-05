<template>
    <form id="signup-account-view" class="st-view" @submit.prevent="goNext">
        <STNavigationBar :title="$t(`Maak jouw account`)"/>

        <main>
            <h1>
                {{ $t('924a46e9-458b-4182-b888-c09b0b8da88c') }}
            </h1>
            <p>
                {{ $t('e8f8a00d-ee08-46bc-9322-984755e7a627') }}
            </p>

            <STErrorsDefault :error-box="errorBox"/>

            <div class="split-inputs">
                <div>
                    <EmailInput v-model="email" name="username" :validator="validator" autocomplete="username" :title="$t(`d99eda85-0c3d-4669-a389-ace3b4e50708`)" :placeholder="$t(`0a65c7be-dcc1-4bf7-9c6e-560085de9052`)"/>
                </div>

                <div>
                    <STInputBox error-fields="firstName,lastName" :error-box="errorBox" :title="$t(`c0b0a159-8e96-40bb-84f6-dd40f579fef5`)">
                        <div class="input-group">
                            <div>
                                <input v-model="firstName" name="given-name" class="input" type="text" autocomplete="given-name" :placeholder="$t(`883f9695-e18f-4df6-8c0d-651c6dd48e59`)"></div>
                            <div>
                                <input v-model="lastName" name="family-name" class="input" type="text" autocomplete="family-name" :placeholder="$t(`f89d8bfa-6b5d-444d-a40f-ec17b3f456ee`)"></div>
                        </div>
                    </STInputBox>
                </div>
            </div>

            <div class="split-inputs">
                <div>
                    <STInputBox error-fields="password" :error-box="errorBox" :title="$t(`64d765de-1861-48c5-a279-e8b7afd7cc04`)">
                        <input v-model="password" name="new-password" class="input" autocomplete="new-password" type="password" :placeholder="$t(`418c9ab2-77de-441b-b9ab-af7bd55558ef`)"></STInputBox>
                    <STInputBox error-fields="passwordRepeat" :error-box="errorBox" :title="$t(`64bc8c3c-4feb-4fb4-b5bf-71726f2b6609`)">
                        <input v-model="passwordRepeat" name="confirm-password" class="input" autocomplete="new-password" type="password" :placeholder="$t(`91317163-c535-47be-a080-0f2b4f055dcc`)"></STInputBox>
                </div>

                <div>
                    <PasswordStrength v-model="password"/>
                </div>
            </div>

            <div class="checkbox-box">
                <Checkbox v-model="acceptPrivacy" class="long-text">
                    {{ $t('5640d1b2-0dfa-4fb3-a5ea-71214bf2947b') }} <a class="inline-link" :href="'https://'+$domains.marketing+'/terms/privacy'" target="_blank">{{ $t('96072da2-bd1e-4bd8-99c9-0cd572f8c83f') }}</a>.
                </Checkbox>

                <Checkbox v-model="acceptTerms" class="long-text">
                    {{ $t('a689c709-899c-4e83-aed4-2d22ebb52f18') }} <a class="inline-link" :href="'https://'+$domains.marketing+'/terms/algemene-voorwaarden'" target="_blank">{{ $t('31101e24-f2d3-4f54-af0a-7fadd2177236') }}</a> {{ $t('2a42726d-41b7-494a-be4f-0497471ba621') }}
                </Checkbox>

                <Checkbox v-model="acceptDataAgreement" class="long-text">
                    {{ $t('a689c709-899c-4e83-aed4-2d22ebb52f18') }} <a class="inline-link" :href="'https://'+$domains.marketing+'/terms/verwerkersovereenkomst'" target="_blank">{{ $t('7add8ff4-5d9b-48a5-85d9-54580fda3a4b') }}</a> {{ $t('2a42726d-41b7-494a-be4f-0497471ba621') }}
                </Checkbox>
            </div>
        </main>

        <STToolbar>
            <template #right>
                <LoadingButton :loading="loading">
                    <button class="button primary" type="button" @click.prevent="goNext">
                        {{ $t('37a0bd14-62bc-45a4-b431-8dd5101de534') }}
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </form>
</template>

<script lang="ts">
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Component, Mixins, Prop } from '@simonbackx/vue-app-navigation/classes';
import { BackButton, Checkbox, ConfirmEmailView, EmailInput, ErrorBox, LoadingButton, PasswordStrength, ReplaceRootEventBus, STErrorsDefault, STInputBox, STNavigationBar, STToolbar, Validator } from '@stamhoofd/components';
import { LoginHelper, SessionContext, SessionManager, Storage } from '@stamhoofd/networking';
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
        PasswordStrength,
    },
})
export default class SignupAccountView extends Mixins(NavigationMixin) {
    @Prop({ required: true })
    organization: Organization;

    @Prop({ required: true })
    registerCode: { code: string; organization: string } | null;

    errorBox: ErrorBox | null = null;
    validator = new Validator();

    password = '';
    passwordRepeat = '';
    email = '';
    firstName = '';
    lastName = '';

    loading = false;
    acceptPrivacy = false;
    acceptTerms = false;
    acceptDataAgreement = false;

    async goNext() {
        if (this.loading) {
            return;
        }

        try {
            // TODO: validate details

            // Generate keys
            this.loading = true;
            this.errorBox = null;

            const valid = await this.validator.validate();

            const errors = new SimpleErrors();
            if (this.firstName.length < 2) {
                errors.addError(new SimpleError({
                    code: 'invalid_field',
                    message: 'Vul jouw voornaam in',
                    field: 'firstName',
                }));
            }
            if (this.lastName.length < 2) {
                errors.addError(new SimpleError({
                    code: 'invalid_field',
                    message: 'Vul jouw achternaam in',
                    field: 'lastName',
                }));
            }
            errors.throwIfNotEmpty();

            if (this.password !== this.passwordRepeat) {
                plausible('passwordsNotMatching'); // track how many people try to create a sorter one (to reevaluate this restriction)
                throw new SimpleError({
                    code: 'password_do_not_match',
                    message: 'De ingevoerde wachtwoorden komen niet overeen',
                    field: 'passwordRepeat',
                });
            }

            if (this.password.length < 8) {
                plausible('passwordTooShort'); // track how many people try to create a sorter one (to reevaluate this restriction)
                throw new SimpleError({
                    code: 'password_too_short',
                    message: 'Jouw wachtwoord moet uit minstens 8 karakters bestaan.',
                    field: 'password',
                });
            }

            if (!this.acceptPrivacy) {
                plausible('termsNotAccepted'); // track how many people try to create a sorter one (to reevaluate this restriction)
                throw new SimpleError({
                    code: 'read_privacy',
                    message: 'Je moet kennis hebben genomen van het privacybeleid voor je een account kan aanmaken.',
                });
            }

            if (!this.acceptTerms) {
                plausible('termsNotAccepted');
                throw new SimpleError({
                    code: 'read_privacy',
                    message: 'Je moet akkoord gaan met de algemene voorwaarden voor je een account kan aanmaken.',
                });
            }

            if (!this.acceptDataAgreement) {
                plausible('termsNotAccepted');
                throw new SimpleError({
                    code: 'read_privacy',
                    message: 'Je moet akkoord gaan met de verwerkersovereenkomst voor je een account kan aanmaken.',
                });
            }
            this.organization.meta.lastSignedTerms = new Date();

            if (!valid) {
                this.loading = false;
                this.errorBox = null;
                return;
            }

            const token = await LoginHelper.signUpOrganization(this.organization, this.email, this.password, this.firstName, this.lastName, this.registerCode?.code);
            plausible('signup');

            this.loading = false;

            try {
                Storage.keyValue.removeItem('savedRegisterCode').catch(console.error);
                Storage.keyValue.removeItem('savedRegisterCodeDate').catch(console.error);
            }
            catch (e) {
                console.error(e);
            }

            const session = new SessionContext(this.organization);
            await SessionManager.prepareSessionForUsage(session, true);
            const dashboardContext = await getScopedDashboardRoot(session, {
                initialPresents: [
                    {
                        components: [new ComponentWithProperties(ConfirmEmailView, { token, email: this.email })],
                        modalDisplayStyle: 'popup',
                    },
                ],
            });
            await this.dismiss({ force: true });
            await ReplaceRootEventBus.sendEvent('replace', dashboardContext);

            // Show popup to confirm e-mail
        }
        catch (e) {
            this.loading = false;
            console.error(e);
            this.errorBox = new ErrorBox(e);
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
