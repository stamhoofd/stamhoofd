<template>
    <LoadingViewTransition :loading="isInitialLoading">
        <SaveView :title="$t('UiTPAS-integratie')" class="edit-sponsor-view" :loading="isSaveLoading" @save="save">
            <h1>
                {{ $t('UiTPAS-integratie') }}
            </h1>

            <p class="style-description-small">
                {{ $t('Haal de gegevens op uit het') }} <a href="https://platform.publiq.be" class="inline-link" target="_blank">{{ $t('Publiq platform') }}</a>{{ $t('.') }}
            </p>

            <STErrorsDefault :error-box="errors.errorBox" />
            <STInputBox error-fields="clientId" :error-box="errors.errorBox" :title="$t('Client id')">
                <input ref="firstInput" v-model="clientId" class="input" type="text" autocomplete="off" :placeholder="$t('Plak hier je client id')">
            </STInputBox>

            <STInputBox error-fields="clientSecret" :error-box="errors.errorBox" :title="$t('Client secret')">
                <input ref="secondInput" v-model="clientSecret" class="input" type="text" autocomplete="off" :placeholder="$t('Plak hier je client secret')">
            </STInputBox>

            <Checkbox v-if="useTestEnv || isPlatformAdmin" v-model="useTestEnv" v-tooltip="!isPlatformAdmin ? $t('Enkel instelbaar door platformbeheerders') : ''" :disabled="!isPlatformAdmin">
                {{ $t('Gebruik UiTPAS-testomgeving') }}
            </Checkbox>
        </SaveView>
    </LoadingViewTransition>
</template>

<script lang="ts" setup>
import { Decoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { Request } from '@simonbackx/simple-networking';
import { usePop } from '@simonbackx/vue-app-navigation';
import { ErrorBox, NavigationActions, SaveView, STErrorsDefault, STInputBox, Toast, useContext, useErrors, useNavigationActions, LoadingViewTransition, useOrganization, Checkbox, usePlatform, useAuth } from '@stamhoofd/components';
import { useRequestOwner } from '@stamhoofd/networking';
import { UitpasClientCredentialsStatus, UitpasClientCredentialsStatusHelper, UitpasGetClientIdResponse, UitpasSetClientCredentialsResponse } from '@stamhoofd/structures';
import { UitpasClientIdAndSecret } from '@stamhoofd/structures';
import { ref, onMounted, watch } from 'vue';

const errors = useErrors();
const pop = usePop();
const context = useContext();
const owner = useRequestOwner();
const isInitialLoading = ref(true);
const isSaveLoading = ref(false);
const clientId = ref('');
const clientSecret = ref('');
const organization = useOrganization();
const platform = usePlatform();
const navigationActions = useNavigationActions();
const auth = useAuth();
const isPlatformAdmin = auth.hasPlatformFullAccess();

let originaClientId: string;

const props = withDefaults(
    defineProps<{
        onFixed?: ((navigation: NavigationActions) => Promise<void>) | null;
    }>(),
    {
        onFixed: null,
    },
);

// add watcher to clientId
watch(clientId, (newValue) => {
    if (newValue !== originaClientId && clientSecret.value === UitpasClientIdAndSecret.placeholderClientSecret) {
        clientSecret.value = '';
    }
});

const useTestEnv = ref(false);

onMounted(async () => {
    try {
        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: '/uitpas/client-id',
            owner,
            shouldRetry: true,
            decoder: UitpasGetClientIdResponse as Decoder<UitpasGetClientIdResponse>,
        });
        originaClientId = response.data.clientId;
        clientId.value = response.data.clientId;
        useTestEnv.value = response.data.useTestEnv;
        if (clientId.value === '') {
            clientSecret.value = '';
        }
        else {
            clientSecret.value = UitpasClientIdAndSecret.placeholderClientSecret;
        }
    }
    catch (e) {
        if (!Request.isAbortError(e)) {
            Toast.fromError(e).show();
        }
    }
    isInitialLoading.value = false;
});

errors.validator.addValidation('clientSecret', () => {
    if (clientSecret.value === '' && (clientId.value !== '' || originaClientId === '')) {
        errors.errorBox = new ErrorBox(new SimpleError({
            code: 'missing_client_secret',
            message: 'missing client secret',
            human: $t('Vul een client secret in'),
            field: 'clientSecret',
        }));
        return false;
    }
    return true;
});

errors.validator.addValidation('clientId', () => {
    if (clientId.value === '' && (clientSecret.value !== '' || originaClientId === '')) {
        errors.errorBox = new ErrorBox(new SimpleError({
            code: 'missing_client_id',
            message: 'missing client id',
            human: $t('Vul een client id in'),
            field: 'clientId',
        }));
        return false;
    }
    return true;
});

async function save() {
    isSaveLoading.value = true;
    if (!await errors.validator.validate()) {
        isSaveLoading.value = false;
        return;
    }
    // validate and store via backend, store new status
    try {
        const cred = new UitpasClientIdAndSecret();
        cred.clientId = clientId.value;
        cred.clientSecret = clientSecret.value;
        cred.useTestEnv = useTestEnv.value;
        const response = await context.value.authenticatedServer.request({
            method: 'POST',
            path: '/uitpas/client-credentials',
            body: cred,
            owner,
            shouldRetry: false,
            decoder: UitpasSetClientCredentialsResponse as Decoder<UitpasSetClientCredentialsResponse>,
        });

        const newStatus = response.data.status;
        if (organization.value) {
            organization.value.meta.uitpasClientCredentialsStatus = newStatus;
        }
        else {
            platform.value.config.uitpasClientCredentialsStatus = newStatus;
        }
        const human = response.data.human;
        if (human) {
            const error = new SimpleError({
                code: 'uitpas-client-credentials-error',
                message: 'set-uitpas-credentials-returned-human-message',
                human: human,
            });
            errors.errorBox = new ErrorBox(error);
            isSaveLoading.value = false;
            return; // do not close the modal
        }
        else {
            if (props.onFixed && newStatus === UitpasClientCredentialsStatus.Ok) {
                await props.onFixed(navigationActions);
            }
            else {
                new Toast(UitpasClientCredentialsStatusHelper.getName(newStatus), UitpasClientCredentialsStatusHelper.getIcon(newStatus)).show();
                await pop({ force: true });
            }
            isSaveLoading.value = false;
        }
    }
    catch (e) {
        console.error(e);
        isSaveLoading.value = false;
        if (!Request.isAbortError(e)) {
            errors.errorBox = new ErrorBox(e);
        }
    }
}
</script>
