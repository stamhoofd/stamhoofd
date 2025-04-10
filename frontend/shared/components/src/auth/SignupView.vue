<template>
    <form class="signup-view st-view" @submit.prevent="submit">
        <STNavigationBar :title="$t(`Account aanmaken`)" />

        <main class="center">
            <h1>{{ $t('Account aanmaken') }}</h1>
            <p v-if="!lock">
                {{ $t('Gebruik bij voorkeur een e-mailadres waarnaar we je al e-mails sturen.') }}
            </p>

            <STErrorsDefault :error-box="errors.errorBox" />

            <EmailInput id="username" ref="emailInput" v-model="email" :autofocus="true" name="username" :validator="errors.validator" autocomplete="username" :disabled="lock !== null" :title="$t(`Persoonlijk e-mailadres`)" :placeholder="$t(`Vul jouw e-mailadres hier in`)" />
            <p v-if="lock" class="style-description-small">
                {{ lock }}
            </p>

            <div class="split-inputs">
                <div>
                    <STInputBox :title="$t(`Kies een wachtwoord`)">
                        <input id="new-password" v-model="password" name="new-password" class="input" autocomplete="new-password" type="password" :placeholder="$t(`Kies een nieuw wachtwoord`)" @input="(event) => password = event.target.value" @change="(event) => password = event.target.value">
                    </STInputBox>

                    <STInputBox :title="$t(`Herhaal wachtwoord`)">
                        <input id="confirm-password" v-model="passwordRepeat" name="confirm-password" class="input" autocomplete="new-password" type="password" :placeholder="$t(`Kies een nieuw wachtwoord`)" @input="(event) => passwordRepeat = event.target.value" @change="(event) => passwordRepeat = event.target.value">
                    </STInputBox>
                </div>
                <div>
                    <PasswordStrength v-model="password" />
                </div>
            </div>

            <SignupPoliciesBox :validator="errors.validator">
                <LoadingButton :loading="loading" class="block input-spacing">
                    <button id="submit" class="button primary" type="submit">
                        <span class="icon lock" />
                        <span>{{ $t('Account aanmaken') }}</span>
                    </button>
                </LoadingButton>
            </SignupPoliciesBox>
        </main>
    </form>
</template>

<script lang="ts" setup>
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, useShow } from '@simonbackx/vue-app-navigation';
import { LoginHelper } from '@stamhoofd/networking';
import { ref } from 'vue';

import { ErrorBox } from '../errors/ErrorBox';
import { useErrors } from '../errors/useErrors';
import { useContext } from '../hooks';
import EmailInput from '../inputs/EmailInput.vue';
import PasswordStrength from '../inputs/PasswordStrength.vue';
import ConfirmEmailView from './ConfirmEmailView.vue';
import SignupPoliciesBox from './components/SignupPoliciesBox.vue';

const props = withDefaults(
    defineProps<{
        initialEmail?: string;
        lock?: string | null;
    }>(), {
        initialEmail: '',
        lock: null,
    },
);

const errors = useErrors();
const $context = useContext();
const show = useShow();

const email = ref(props.initialEmail);
const password = ref('');
const passwordRepeat = ref('');
const loading = ref(false);

async function submit() {
    if (loading.value) {
        return;
    }

    const valid = await errors.validator.validate();

    if (password.value !== passwordRepeat.value) {
        errors.errorBox = new ErrorBox(
            new SimpleError({
                code: 'password_mismatch',
                message: 'De ingevoerde wachtwoorden komen niet overeen',
            }),
        );
        return;
    }

    if (password.value.length < 8) {
        errors.errorBox = new ErrorBox(new SimpleError({
            code: 'password_too_short',
            message: 'Jouw wachtwoord moet uit minstens 8 karakters bestaan.',
        }));
        return;
    }

    if (!valid) {
        errors.errorBox = null;
        return;
    }

    loading.value = true;
    errors.errorBox = null;

    try {
        const token = await LoginHelper.signUp($context.value, email.value, password.value);
        loading.value = false;
        await show({
            components: [
                new ComponentWithProperties(ConfirmEmailView, {
                    token,
                    email: email.value,
                }),
            ],
        });
        return;
    }
    catch (e) {
        loading.value = false;
        errors.errorBox = new ErrorBox(e);
    }
}
</script>
