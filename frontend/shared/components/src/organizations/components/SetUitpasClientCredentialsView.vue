<template>
    <LoadingViewTransition :loading="isInitialLoading">
        <SaveView :title="$t('aafe1357-1b66-4122-beb0-b773a933a477')" class="edit-sponsor-view" :loading="isSaveLoading" @save="save">
            <h1>
                {{ $t('aafe1357-1b66-4122-beb0-b773a933a477') }}
            </h1>

            <p class="style-description-small">
                {{ $t('b364c428-7d28-418e-9dba-08bce39433b2') }} <a href="https://platform.publiq.be" class="inline-link" target="_blank">{{ $t('fa9e3bb7-5491-47f8-8939-0370767107b9') }}</a>{{ $t('5658edc2-ca76-4463-8729-6b7438249d91') }}
            </p>

            <STErrorsDefault :error-box="errors.errorBox" />
            <STInputBox error-fields="clientId" :error-box="errors.errorBox" :title="$t('63b4a0d5-b7a6-416f-8ac1-68fcdc4e88f6')">
                <input ref="firstInput" v-model="clientId" class="input" type="text" autocomplete="off" :placeholder="$t('74235c2d-fe1f-4d38-821e-2ace113152ef')">
            </STInputBox>

            <STInputBox error-fields="clientSecret" :error-box="errors.errorBox" :title="$t('c9e33324-eb11-44af-8701-0ef6b4c322e6')">
                <input ref="secondInput" v-model="clientSecret" class="input" type="text" autocomplete="off" :placeholder="$t('9a3796e7-0eeb-495a-9289-74fbcec07a0c')">
            </STInputBox>
        </SaveView>
    </LoadingViewTransition>
</template>

<script lang="ts" setup>
import { Decoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { Request } from '@simonbackx/simple-networking';
import { usePop } from '@simonbackx/vue-app-navigation';
import { ErrorBox, NavigationActions, SaveView, STErrorsDefault, STInputBox, Toast, useContext, useErrors, useNavigationActions, useRequiredOrganization, LoadingViewTransition } from '@stamhoofd/components';
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
const organization = useRequiredOrganization();
const navigationActions = useNavigationActions();

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

onMounted(async () => {
    try {
        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: '/organization/uitpas-client-id',
            owner,
            shouldRetry: true,
            decoder: UitpasGetClientIdResponse as Decoder<UitpasGetClientIdResponse>,
        });
        originaClientId = response.data.clientId;
        clientId.value = response.data.clientId;
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
        throw new SimpleError({
            code: 'missing_client_secret',
            message: 'missing client secret',
            human: $t('eaeba023-03b7-480d-8e2f-4849d7585909'),
            field: 'clientSecret',
        });
    }
    return true;
});

errors.validator.addValidation('clientId', () => {
    if (clientId.value === '' && (clientSecret.value !== '' || originaClientId === '')) {
        throw new SimpleError({
            code: 'missing_client_id',
            message: 'missing client id',
            human: $t('76dfb997-817a-4d98-8ba3-0daacd0f5957'),
            field: 'clientId',
        });
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
        const response = await context.value.authenticatedServer.request({
            method: 'POST',
            path: '/organization/uitpas-client-credentials',
            body: cred,
            owner,
            shouldRetry: false,
            decoder: UitpasSetClientCredentialsResponse as Decoder<UitpasSetClientCredentialsResponse>,
        });

        const newStatus = response.data.status;
        organization.value.meta.uitpasClientCredentialsStatus = newStatus;
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
            if (organization.value) {
                organization.value.meta.uitpasClientCredentialsStatus = newStatus;
            }
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
