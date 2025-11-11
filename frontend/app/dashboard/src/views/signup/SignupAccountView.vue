<template>
    <form id="signup-account-view" class="st-view" @submit.prevent="goNext">
        <STNavigationBar :title="$t(`cc49441a-2dba-4263-a93d-23008adac4f8`)" />

        <main>
            <h1>
                {{ $t('8b1933de-fb99-4a61-91c0-a80e5d09cef5') }}
            </h1>
            <p>
                {{ $t('0b78041e-b438-46c5-a7f3-62915022c294') }}
            </p>

            <STErrorsDefault :error-box="errorBox" />

            <div class="split-inputs">
                <div>
                    <EmailInput v-model="email" data-testid="email-input" name="username" :validator="validator" autocomplete="username" :title="$t(`26cb7015-6d17-4c3b-8b94-f44f38576854`)" :placeholder="$t(`55d8cd6e-91d1-4cbe-b9b4-f367bbf37b62`)" />
                </div>

                <div>
                    <STInputBox error-fields="firstName,lastName" :error-box="errorBox" :title="$t(`f50f1057-e8a0-472e-ae14-2f393f79db53`)">
                        <div class="input-group">
                            <div>
                                <input v-model="firstName" data-testid="first-name-input" name="given-name" class="input" type="text" autocomplete="given-name" :placeholder="$t(`ca52d8d3-9a76-433a-a658-ec89aeb4efd5`)">
                            </div>
                            <div>
                                <input v-model="lastName" data-testid="last-name-input" name="family-name" class="input" type="text" autocomplete="family-name" :placeholder="$t(`171bd1df-ed4b-417f-8c5e-0546d948469a`)">
                            </div>
                        </div>
                    </STInputBox>
                </div>
            </div>

            <div class="split-inputs">
                <div>
                    <STInputBox error-fields="password" :error-box="errorBox" :title="$t(`d220bb47-196f-4ffb-9f0a-367234ced464`)">
                        <input v-model="password" data-testid="password-input" name="new-password" class="input" autocomplete="new-password" type="password" :placeholder="$t(`adf7def3-6328-4261-a390-6cd006737aaf`)">
                    </STInputBox>
                    <STInputBox error-fields="passwordRepeat" :error-box="errorBox" :title="$t(`ed8aef93-717e-406c-a779-2465dcd07baa`)">
                        <input v-model="passwordRepeat" data-testid="password-repeat-input" name="confirm-password" class="input" autocomplete="new-password" type="password" :placeholder="$t(`79537e4c-5363-4f06-9d82-9b1b007add73`)">
                    </STInputBox>
                </div>

                <div>
                    <PasswordStrength v-model="password" />
                </div>
            </div>

            <div class="checkbox-box">
                <Checkbox v-model="acceptPrivacy" class="long-text" data-testid="accept-privacy-input">
                    {{ $t('df2f7ae1-ad07-4ec4-94c0-939dd3f6bc8d') }} <a class="inline-link" :href="'https://'+$domains.marketing+'/terms/privacy'" target="_blank">{{ $t('005c5e2d-8185-46e7-b1a0-4e4eaaf60d41') }}</a>.
                </Checkbox>

                <Checkbox v-model="acceptTerms" class="long-text" data-testid="accept-terms-input">
                    {{ $t('b22d5516-2644-4f4a-bcb5-ad93b82a0d61') }} <a class="inline-link" :href="'https://'+$domains.marketing+'/terms/algemene-voorwaarden'" target="_blank">{{ $t('1943d3e6-4550-4240-b2f7-5aaa74e55f5d') }}</a> {{ $t('da2d2d9e-07cc-471e-963a-7915c7698ba9') }}
                </Checkbox>

                <Checkbox v-model="acceptDataAgreement" class="long-text" data-testid="accept-data-agreement-input">
                    {{ $t('b22d5516-2644-4f4a-bcb5-ad93b82a0d61') }} <a class="inline-link" :href="'https://'+$domains.marketing+'/terms/verwerkersovereenkomst'" target="_blank">{{ $t('2b08e5d7-6acc-4d7f-ad1a-30f349a79fe9') }}</a> {{ $t('da2d2d9e-07cc-471e-963a-7915c7698ba9') }}
                </Checkbox>
            </div>
        </main>

        <STToolbar>
            <template #right>
                <LoadingButton :loading="loading">
                    <button class="button primary" type="button" data-testid="signup-account-button" @click.prevent="goNext">
                        {{ $t('657d0ca3-739f-48bc-b4c0-b4c326b59834') }}
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

import { getScopedAutoRoot } from '../../getRootViews';

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
        console.error('playwright debug - start goNext');
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

            console.error('playwright debug - get token - start');
            const token = await LoginHelper.signUpOrganization(this.organization, this.email, this.password, this.firstName, this.lastName, this.registerCode?.code);
            console.error('playwright debug - get token - done');
            plausible('signup');

            this.loading = false;

            try {
                Storage.keyValue.removeItem('savedRegisterCode').catch(console.error);
                Storage.keyValue.removeItem('savedRegisterCodeDate').catch(console.error);
            }
            catch (e) {
                console.error(e);
            }

            console.error('playwright debug - new session');
            const session = new SessionContext(this.organization);
            console.error('playwright debug - prepare session');
            await SessionManager.prepareSessionForUsage(session, true);
            console.error('playwright debug - dasbboard context');
            const dashboardContext = await getScopedAutoRoot(session, {
                initialPresents: [
                    {
                        components: [
                            new ComponentWithProperties(ConfirmEmailView, { token, email: this.email }),
                        ],
                        modalDisplayStyle: 'popup',
                    },
                ],
            });
            console.error('playwright debug - dismiss');
            await this.dismiss({ force: true });
            console.error('playwright debug - send event');
            await ReplaceRootEventBus.sendEvent('replace', dashboardContext);

            // Show popup to confirm e-mail
        }
        catch (e) {
            this.loading = false;
            console.error(e);
            this.errorBox = new ErrorBox(e);
            plausible('signupAccountError');

            if (STAMHOOFD.environment === 'development' && this.email.length === 0) {
                console.log('Autofill for development mode enabled. Filling in default values...');
                // Autofill all
                this.email = 'simon@stamhoofd.be';
                this.password = 'stamhoofd';
                this.passwordRepeat = 'stamhoofd';
                this.firstName = 'Test';
                this.lastName = 'Gebruiker';
                this.acceptPrivacy = true;
                this.acceptTerms = true;
                this.acceptDataAgreement = true;
            }
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
