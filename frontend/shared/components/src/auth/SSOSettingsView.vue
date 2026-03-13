<template>
    <SaveView :loading-view="!ssoConfiguration" :loading="saving" :disabled="!hasChanges" :error-box="errors.errorBox" :title="$t(`%1O`)" @save="save">
        <h1>
            {{ $t('%1X') }}{{ provider }})
        </h1>
        <p>
            {{ $t('%Zr') }} <a href="https://learn.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app" target="_blank" class="inline-link">{{ $t('%Zs') }}</a> {{ $t('%Zt') }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STInputBox error-fields="issuer" :error-box="errors.errorBox" class="max" :title="$t(`%O`)">
            <input ref="firstInput" v-model="issuer" class="input" type="text" autocomplete="off" :placeholder="$t(`%Zv`)">
        </STInputBox>

        <STInputBox error-fields="clientId" :error-box="errors.errorBox" class="max" :title="$t(`%1c`)">
            <input v-model="clientId" class="input" type="text" autocomplete="off" :placeholder="$t(`%Zw`)">
        </STInputBox>

        <STInputBox error-fields="clientSecret" :error-box="errors.errorBox" class="max" :title="$t(`%1E`)">
            <input v-model="clientSecret" class="input" type="text" autocomplete="off" :placeholder="$t(`%Zw`)">
        </STInputBox>

        <STInputBox :error-box="errors.errorBox" class="max" :title="$t(`%n`)">
            <input v-model="redirectUri" :placeholder="defaultRedirectUri" class="input" type="text" autocomplete="off"><template #right>
                <button v-copyable="redirectUri || defaultRedirectUri" class="button icon copy small" type="button" />
            </template>
        </STInputBox>
        <p class="style-description-small">
            {{ $t('%Zu') }}
        </p>
    </SaveView>
</template>

<script lang="ts" setup>
import { ErrorBox } from '#errors/ErrorBox.ts';
import { useErrors } from '#errors/useErrors.ts';
import { useContext } from '#hooks/useContext.ts';
import { useOrganization } from '#hooks/useOrganization.ts';
import { usePatch } from '#hooks/usePatch.ts';
import { CenteredMessage } from '#overlays/CenteredMessage.ts';
import { Toast } from '#overlays/Toast.ts';
import { Decoder } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
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

        new Toast($t(`%HA`), 'success green').show();
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
    return await CenteredMessage.confirm($t('%A0'), $t('%4X'));
};

defineExpose({
    shouldNavigateAway,
});
</script>
