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

            <STErrorsDefault :error-box="errors.errorBox" />

            <div class="split-inputs">
                <div>
                    <EmailInput v-model="email" data-testid="email-input" name="username" :validator="errors.validator" autocomplete="username" :title="$t(`%WS`)" :placeholder="$t(`%WT`)" />
                </div>

                <div>
                    <STInputBox error-fields="firstName,lastName" :error-box="errors.errorBox" :title="$t(`%Uy`)">
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
                    <STInputBox error-fields="password" :error-box="errors.errorBox" :title="$t(`%WU`)">
                        <input v-model="password" data-testid="password-input" name="new-password" class="input" autocomplete="new-password" type="password" :placeholder="$t(`%WV`)">
                    </STInputBox>
                    <STInputBox error-fields="passwordRepeat" :error-box="errors.errorBox" :title="$t(`%WW`)">
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

<script lang="ts" setup>
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, useDismiss } from '@simonbackx/vue-app-navigation';
import { useErrors } from '@stamhoofd/components';
import ConfirmEmailView from '@stamhoofd/components/auth/ConfirmEmailView.vue';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import Checkbox from '@stamhoofd/components/inputs/Checkbox.vue';
import EmailInput from '@stamhoofd/components/inputs/EmailInput.vue';
import PasswordStrength from '@stamhoofd/components/inputs/PasswordStrength.vue';
import STInputBox from '@stamhoofd/components/inputs/STInputBox.vue';
import LoadingButton from '@stamhoofd/components/navigation/LoadingButton.vue';
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
import STToolbar from '@stamhoofd/components/navigation/STToolbar.vue';
import { ReplaceRootEventBus } from '@stamhoofd/components/overlays/ModalStackEventBus.ts';
import { LoginHelper } from '@stamhoofd/networking/LoginHelper';
import { SessionContext } from '@stamhoofd/networking/SessionContext';
import { SessionManager } from '@stamhoofd/networking/SessionManager';
import { Storage } from '@stamhoofd/networking/Storage';
import { Organization } from '@stamhoofd/structures';
import { ref } from 'vue';
import { getScopedAutoRoot } from '../../getRootViews';

const props = defineProps<{
    organization: Organization;
    registerCode: { code: string; organization: string } | null;
}>();

const errors = useErrors();
const dismiss = useDismiss();

const password = ref('');
const passwordRepeat = ref('');
const email = ref('');
const firstName = ref('');
const lastName = ref('');

const loading = ref(false);
const acceptPrivacy = ref(false);
const acceptTerms = ref(false);
const acceptDataAgreement = ref(false);

async function goNext() {
    if (loading.value) {
        return;
    }

    try {
        // TODO: validate details

        // Generate keys
        loading.value = true;
        errors.errorBox = null;

        const valid = await errors.validator.validate();

        const simpleErrors = new SimpleErrors();
        if (firstName.value.length < 2) {
            simpleErrors.addError(new SimpleError({
                code: 'invalid_field',
                message: 'Vul jouw voornaam in',
                field: 'firstName',
            }));
        }
        if (lastName.value.length < 2) {
            simpleErrors.addError(new SimpleError({
                code: 'invalid_field',
                message: 'Vul jouw achternaam in',
                field: 'lastName',
            }));
        }
        simpleErrors.throwIfNotEmpty();

        if (password.value !== passwordRepeat.value) {
            plausible('passwordsNotMatching'); // track how many people try to create a sorter one (to reevaluate this restriction)
            throw new SimpleError({
                code: 'password_do_not_match',
                message: 'De ingevoerde wachtwoorden komen niet overeen',
                field: 'passwordRepeat',
            });
        }

        if (password.value.length < 8) {
            plausible('passwordTooShort'); // track how many people try to create a sorter one (to reevaluate this restriction)
            throw new SimpleError({
                code: 'password_too_short',
                message: 'Jouw wachtwoord moet uit minstens 8 karakters bestaan.',
                field: 'password',
            });
        }

        if (!acceptPrivacy.value) {
            plausible('termsNotAccepted'); // track how many people try to create a sorter one (to reevaluate this restriction)
            throw new SimpleError({
                code: 'read_privacy',
                message: 'Je moet kennis hebben genomen van het privacybeleid voor je een account kan aanmaken.',
            });
        }

        if (!acceptTerms.value) {
            plausible('termsNotAccepted');
            throw new SimpleError({
                code: 'read_privacy',
                message: 'Je moet akkoord gaan met de algemene voorwaarden voor je een account kan aanmaken.',
            });
        }

        if (!acceptDataAgreement.value) {
            plausible('termsNotAccepted');
            throw new SimpleError({
                code: 'read_privacy',
                message: 'Je moet akkoord gaan met de verwerkersovereenkomst voor je een account kan aanmaken.',
            });
        }
        props.organization.meta.lastSignedTerms = new Date();

        if (!valid) {
            loading.value = false;
            errors.errorBox = null;
            return;
        }

        const token = await LoginHelper.signUpOrganization(props.organization, email.value, password.value, firstName.value, lastName.value, props.registerCode?.code);
        plausible('signup');

        loading.value = false;

        try {
            Storage.keyValue.removeItem('savedRegisterCode').catch(console.error);
            Storage.keyValue.removeItem('savedRegisterCodeDate').catch(console.error);
        }
        catch (e) {
            console.error(e);
        }

        const session = new SessionContext(props.organization);
        await SessionManager.prepareSessionForUsage(session, true);
        const dashboardContext = await getScopedAutoRoot(session, {
            initialPresents: [
                {
                    components: [
                        new ComponentWithProperties(ConfirmEmailView, { token, email: email.value }),
                    ],
                    modalDisplayStyle: 'popup',
                },
            ],
        });
        await dismiss({ force: true });
        await ReplaceRootEventBus.sendEvent('replace', dashboardContext);

        // Show popup to confirm e-mail
    }
    catch (e) {
        loading.value = false;
        console.error(e);
        errors.errorBox = new ErrorBox(e);
        plausible('signupAccountError');

        if (STAMHOOFD.environment === 'development' && email.value.length === 0) {
            console.log('Autofill for development mode enabled. Filling in default values...');
            // Autofill all
            email.value = 'simon@stamhoofd.be';
            password.value = 'stamhoofd';
            passwordRepeat.value = 'stamhoofd';
            firstName.value = 'Test';
            lastName.value = 'Gebruiker';
            acceptPrivacy.value = true;
            acceptTerms.value = true;
            acceptDataAgreement.value = true;
        }
        return;
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
