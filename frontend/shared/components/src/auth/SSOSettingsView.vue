<template>
    <SaveView :loading-view="!ssoConfiguration" :loading="saving" :disabled="!hasChanges" :error-box="errors.errorBox" @save="save" :title="$t(`e0a3fd15-c83a-44bb-8c27-9d97773d27f6`)">
        <h1>
            {{ $t('17cc7c9a-7dd0-40a5-be9b-8dbe825c1aef') }}{{ provider }})
        </h1>
        <p>
            {{ $t('4388e081-0206-4b64-9697-d37b462a3bbe') }} <a href="https://learn.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app" target="_blank" class="inline-link">{{ $t('f3831259-217f-4dc7-b857-c8e4aa7488e8') }}</a> {{ $t('46eb72ba-bcd5-4759-b22b-23d5fe285bd7') }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox"/>

        <STInputBox error-fields="issuer" :error-box="errors.errorBox" class="max" :title="$t(`7aa443d3-138a-4dc5-a64e-68492f807bc5`)">
            <input ref="firstInput" v-model="issuer" class="input" type="text" autocomplete="off" :placeholder="$t(`84412729-6ef1-4226-90ad-e9c1c7b1a707`)"></STInputBox>

        <STInputBox error-fields="clientId" :error-box="errors.errorBox" class="max" :title="$t(`22220280-b5bd-47c9-bdf3-dc6120c0a560`)">
            <input v-model="clientId" class="input" type="text" autocomplete="off" :placeholder="$t(`4b6e96bc-9298-4329-b762-2ded076cdaa3`)"></STInputBox>

        <STInputBox error-fields="clientSecret" :error-box="errors.errorBox" class="max" :title="$t(`b0205f8a-ba20-4c89-86a9-c72cecd417c9`)">
            <input v-model="clientSecret" class="input" type="text" autocomplete="off" :placeholder="$t(`4b6e96bc-9298-4329-b762-2ded076cdaa3`)"></STInputBox>

        <STInputBox :error-box="errors.errorBox" class="max" :title="$t(`19f32b17-e40a-4aba-9509-39ed3bfed1ec`)">
            <input v-model="redirectUri" :placeholder="defaultRedirectUri" class="input" type="text" autocomplete="off"><template #right>
                <button v-copyable="redirectUri || defaultRedirectUri" class="button icon copy small" type="button"/>
            </template>
        </STInputBox>
        <p class="style-description-small">
            {{ $t('f4d97bc0-5345-4330-8886-bda4ccb0b676') }}
        </p>
    </SaveView>
</template>

<script lang="ts" setup>
import { Decoder } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ErrorBox, Toast, useContext, useErrors, useOrganization, usePatch, usePlatform } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { usePlatformManager, useRequestOwner } from '@stamhoofd/networking';
import { LoginProviderType, OpenIDClientConfiguration } from '@stamhoofd/structures';
import { computed, onMounted, Ref, ref } from 'vue';

const props = withDefaults(
    defineProps<{
        provider: LoginProviderType;
    }>(), {
    },
);

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
            query: {
                provider: props.provider,
            },
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
            query: {
                provider: props.provider,
            },
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
