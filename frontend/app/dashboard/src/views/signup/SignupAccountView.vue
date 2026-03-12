<template>
    <form id="signup-account-view" class="st-view" @submit.prevent="goNext">
        <STNavigationBar :title="$t(`%WQ`)" />

        <main>
            <h1>
                {{ $t('%WQ') }}
            </h1>
            <p>
                {{ $t('%WR') }}
            </p>

            <STErrorsDefault :error-box="errorBox" />

            <div class="split-inputs">
                <div>
                    <EmailInput v-model="email" data-testid="email-input" name="username" :validator="validator" autocomplete="username" :title="$t(`%WS`)" :placeholder="$t(`%WT`)" />
                </div>

                <div>
                    <STInputBox error-fields="firstName,lastName" :error-box="errorBox" :title="$t(`%Uy`)">
                        <div class="input-group">
                            <div>
                                <input v-model="firstName" data-testid="first-name-input" name="given-name" class="input" type="text" autocomplete="given-name" :placeholder="$t(`%1MT`)">
                            </div>
                            <div>
                                <input v-model="lastName" data-testid="last-name-input" name="family-name" class="input" type="text" autocomplete="family-name" :placeholder="$t(`%1MU`)">
                            </div>
                        </div>
                    </STInputBox>
                </div>
            </div>

            <div class="split-inputs">
                <div>
                    <STInputBox error-fields="password" :error-box="errorBox" :title="$t(`%WU`)">
                        <input v-model="password" data-testid="password-input" name="new-password" class="input" autocomplete="new-password" type="password" :placeholder="$t(`%WV`)">
                    </STInputBox>
                    <STInputBox error-fields="passwordRepeat" :error-box="errorBox" :title="$t(`%WW`)">
                        <input v-model="passwordRepeat" data-testid="password-repeat-input" name="confirm-password" class="input" autocomplete="new-password" type="password" :placeholder="$t(`%WX`)">
                    </STInputBox>
                </div>

                <div>
                    <PasswordStrength v-model="password" />
                </div>
            </div>

            <div class="checkbox-box">
                <Checkbox v-model="acceptPrivacy" class="long-text" data-testid="accept-privacy-input">
                    {{ $t('%Jg') }} <a class="inline-link" :href="'https://'+$domains.marketing+'/terms/privacy'" target="_blank">{{ $t('%Jh') }}</a>.
                </Checkbox>

                <Checkbox v-model="acceptTerms" class="long-text" data-testid="accept-terms-input">
                    {{ $t('%Ji') }} <a class="inline-link" :href="'https://'+$domains.marketing+'/terms/algemene-voorwaarden'" target="_blank">{{ $t('%Jj') }}</a> {{ $t('%Jk') }}
                </Checkbox>

                <Checkbox v-model="acceptDataAgreement" class="long-text" data-testid="accept-data-agreement-input">
                    {{ $t('%Ji') }} <a class="inline-link" :href="'https://'+$domains.marketing+'/terms/verwerkersovereenkomst'" target="_blank">{{ $t('%Jl') }}</a> {{ $t('%Jk') }}
                </Checkbox>
            </div>
        </main>

        <STToolbar>
            <template #right>
                <LoadingButton :loading="loading">
                    <button class="button primary" type="button" data-testid="signup-account-button" @click.prevent="goNext">
                        {{ $t('%ur') }}
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
import BackButton from '@stamhoofd/components/navigation/BackButton.vue';
import Checkbox from '@stamhoofd/components/inputs/Checkbox.vue';
import ConfirmEmailView from '@stamhoofd/components/auth/ConfirmEmailView.vue';
import EmailInput from '@stamhoofd/components/inputs/EmailInput.vue';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import LoadingButton from '@stamhoofd/components/navigation/LoadingButton.vue';
import PasswordStrength from '@stamhoofd/components/inputs/PasswordStrength.vue';
import { ReplaceRootEventBus } from '@stamhoofd/components/overlays/ModalStackEventBus.ts';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import STInputBox from '@stamhoofd/components/inputs/STInputBox.vue';
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
import STToolbar from '@stamhoofd/components/navigation/STToolbar.vue';
import { Validator } from '@stamhoofd/components/errors/Validator.ts';
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
