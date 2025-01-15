<template>
    <SaveView :loading-view="!ssoConfiguration" :loading="saving" title="Single-Sign-On" :disabled="!hasChanges" :error-box="errors.errorBox" @save="save">
        <h1>
            Single-Sign-On
        </h1>
        <p>
            Zorg dat gebruikers kunnen inloggen via je eigen accountsysteem, apart van Stamhoofd. Voor Microsoft kan je <a href="https://learn.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app" target="_blank" class="inline-link">deze</a> handleiding volgen.
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STInputBox title="Issuer" error-fields="issuer" :error-box="errors.errorBox">
            <input
                ref="firstInput"
                v-model="issuer"
                class="input"
                type="text"
                placeholder="bv. https://login.microsoftonline.com/contoso.onmicrosoft.com/v2.0"
                autocomplete=""
            >
        </STInputBox>

        <STInputBox title="Client ID" error-fields="clientId" :error-box="errors.errorBox">
            <input
                v-model="clientId"
                class="input"
                type="text"
                placeholder="bv. 12345678-1234-1234-1234-123456789012"
                autocomplete=""
            >
        </STInputBox>

        <STInputBox title="Client Secret" error-fields="clientSecret" :error-box="errors.errorBox">
            <input
                v-model="clientSecret"
                class="input"
                type="text"
                placeholder="bv. 12345678-1234-1234-1234-123456789012"
                autocomplete=""
            >
        </STInputBox>

        <STInputBox title="Redirect URI" :error-box="errors.errorBox">
            <input
                v-model="redirectUri"
                :placeholder="defaultRedirectUri"
                class="input"
                type="text"
                autocomplete=""
            >
        </STInputBox>
        <p class="style-description-small">
            De redirect URI behoud je best op de voorgestelde waarde.
        </p>
    </SaveView>
</template>

<script lang="ts" setup>
import { Decoder } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ErrorBox, Toast, useContext, useErrors, useOrganization, usePatch, usePlatform } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { usePlatformManager, useRequestOwner } from '@stamhoofd/networking';
import { OpenIDClientConfiguration } from '@stamhoofd/structures';
import { computed, onMounted, Ref, ref } from 'vue';

const errors = useErrors();
const pop = usePop();
const $t = useTranslate();
const context = useContext();
const owner = useRequestOwner();
const organization = useOrganization();

const saving = ref(false);

const ssoConfiguration = ref(null) as Ref<OpenIDClientConfiguration | null>;
const { patched, patch, hasChanges, addPatch } = usePatch(
    computed(() => ssoConfiguration.value ?? OpenIDClientConfiguration.create({})),
);

onMounted(async () => {
    await loadConfiguration();
});

const issuer = computed({
    get: () => patched.value.issuer,
    set: (value: string) => addPatch({ issuer: value }),
});

const clientId = computed({
    get: () => patched.value.clientId,
    set: (value: string) => addPatch({ clientId: value }),
});

const clientSecret = computed({
    get: () => patched.value.clientSecret,
    set: (value: string) => addPatch({ clientSecret: value }),
});

const redirectUri = computed({
    get: () => patched.value.redirectUri ?? '',
    set: (value: string | null) => addPatch({ redirectUri: value ? value : null }),
});

const defaultRedirectUri = computed(() => {
    if (organization.value) {
        return 'https://' + organization.value.id + '.' + STAMHOOFD.domains.api + '/openid/callback';
    }
    return 'https://' + STAMHOOFD.domains.api + '/openid/callback';
});

async function loadConfiguration() {
    try {
        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: '/sso',
            decoder: OpenIDClientConfiguration as Decoder<OpenIDClientConfiguration>,
            owner,
            shouldRetry: true,
        });
        ssoConfiguration.value = response.data;
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
}

async function save() {
    if (saving.value) {
        return;
    }

    saving.value = true;

    try {
        if (!await errors.validator.validate()) {
            saving.value = false;
            return;
        }
        await context.value.authenticatedServer.request({
            method: 'POST',
            path: '/sso',
            decoder: OpenIDClientConfiguration as Decoder<OpenIDClientConfiguration>,
            body: patch.value,
            owner,
            shouldRetry: false,
        });

        new Toast('De wijzigingen zijn opgeslagen', 'success green').show();
        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }

    saving.value = false;
}

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm($t('996a4109-5524-4679-8d17-6968282a2a75'), $t('106b3169-6336-48b8-8544-4512d42c4fd6'));
};

defineExpose({
    shouldNavigateAway,
});
</script>
