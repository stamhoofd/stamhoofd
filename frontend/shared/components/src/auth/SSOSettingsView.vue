<template>
    <SaveView :loading-view="!ssoConfiguration" :loading="saving" :disabled="!hasChanges" :error-box="errors.errorBox" :title="$t(`8cdbbc91-88ab-4d25-8f42-b34369e959f0`)" @save="save">
        <h1>
            {{ $t('979af771-f3ab-4105-9478-d8ee14db66f1') }}{{ provider }})
        </h1>
        <p>
            {{ $t('fcd3549b-1d81-4fe7-9e8f-fcd17501c014') }} <a href="https://learn.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app" target="_blank" class="inline-link">{{ $t('850e99a6-c2c9-4ba9-9159-d3ac3a74de63') }}</a> {{ $t('33fe6b98-1a87-4d0c-831d-5fcb441ee018') }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STInputBox error-fields="issuer" :error-box="errors.errorBox" class="max" :title="$t(`0b6247ef-b8bb-4ed7-b403-b0a58ddebaf5`)">
            <input ref="firstInput" v-model="issuer" class="input" type="text" autocomplete="off" :placeholder="$t(`472e545f-4d75-4885-aeec-be67a6def534`)">
        </STInputBox>

        <STInputBox error-fields="clientId" :error-box="errors.errorBox" class="max" :title="$t(`9db3d461-f36c-4b2e-9e51-0b1e9a1517c2`)">
            <input v-model="clientId" class="input" type="text" autocomplete="off" :placeholder="$t(`2065700b-bddc-4616-a67b-5c331ab31df7`)">
        </STInputBox>

        <STInputBox error-fields="clientSecret" :error-box="errors.errorBox" class="max" :title="$t(`70af9014-24ec-484c-b11b-4e2510bb09c1`)">
            <input v-model="clientSecret" class="input" type="text" autocomplete="off" :placeholder="$t(`2065700b-bddc-4616-a67b-5c331ab31df7`)">
        </STInputBox>

        <STInputBox :error-box="errors.errorBox" class="max" :title="$t(`3b81d4a5-0af5-4807-8ea9-264d2f99ee05`)">
            <input v-model="redirectUri" :placeholder="defaultRedirectUri" class="input" type="text" autocomplete="off"><template #right>
                <button v-copyable="redirectUri || defaultRedirectUri" class="button icon copy small" type="button" />
            </template>
        </STInputBox>
        <p class="style-description-small">
            {{ $t('c6e6c4b8-b3ad-4163-aa08-bbf22cc337aa') }}
        </p>
    </SaveView>
</template>

<script lang="ts" setup>
import { Decoder } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ErrorBox, Toast, useContext, useErrors, useOrganization, usePatch } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { useRequestOwner } from '@stamhoofd/networking';
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
