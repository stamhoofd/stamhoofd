<template>
    <form class="signup-view st-view" @submit.prevent="submit">
        <STNavigationBar :title="$t(`2fd0cda5-225c-4b65-87b1-210c9b54023c`)" />

        <main class="center">
            <h1 v-if="STAMHOOFD.userMode === 'organization' && $context.organization">
                {{ $t('Account aanmaken bij {organization}', {organization: $context.organization.name}) }}
            </h1>
            <h1 v-else>
                {{ $t('657d0ca3-739f-48bc-b4c0-b4c326b59834') }}
            </h1>

            <p v-if="!lock">
                {{ $t('24183997-792a-47c5-b43d-53ba713f80f1') }}
            </p>

            <STErrorsDefault :error-box="errors.errorBox" />

            <EmailInput id="username" ref="emailInput" v-model="email" :autofocus="true" name="username" :validator="errors.validator" autocomplete="username" :disabled="lock !== null" :title="$t(`26cb7015-6d17-4c3b-8b94-f44f38576854`)" :placeholder="$t(`55d8cd6e-91d1-4cbe-b9b4-f367bbf37b62`)" />
            <p v-if="lock" class="style-description-small">
                {{ lock }}
            </p>

            <div class="split-inputs">
                <div>
                    <STInputBox :title="$t(`adf7def3-6328-4261-a390-6cd006737aaf`)">
                        <input id="new-password" v-model="password" name="new-password" class="input" autocomplete="new-password" type="password" :placeholder="$t(`722ac9a8-7ccb-4e3b-aa51-77132c19b2bb`)" @input="(event: any) => password = event.target.value" @change="(event: any) => password = event.target.value">
                    </STInputBox>

                    <STInputBox :title="$t(`ed8aef93-717e-406c-a779-2465dcd07baa`)">
                        <input id="confirm-password" v-model="passwordRepeat" name="confirm-password" class="input" autocomplete="new-password" type="password" :placeholder="$t(`722ac9a8-7ccb-4e3b-aa51-77132c19b2bb`)" @input="(event: any) => passwordRepeat = event.target.value" @change="(event: any) => passwordRepeat = event.target.value">
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
                        <span>{{ $t('657d0ca3-739f-48bc-b4c0-b4c326b59834') }}</span>
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
                message: $t(`a5fbbeef-50dc-4825-8677-ba984b13d5cc`),
            }),
        );
        return;
    }

    if (password.value.length < 8) {
        errors.errorBox = new ErrorBox(new SimpleError({
            code: 'password_too_short',
            message: $t(`bac8adfa-0bd1-4180-9143-767f24efa111`),
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
