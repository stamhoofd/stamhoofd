<template>
    <div id="account-view" class="st-view">
        <STNavigationBar :title="$t('a48e6035-5e61-4fc7-9ac4-89016e7174fe')" />

        <main class="center">
            <h1>
                {{ $t("a48e6035-5e61-4fc7-9ac4-89016e7174fe") }}
            </h1>
            <p>{{ $t('76741df9-b885-4143-b2eb-210329e23169') }}</p>

            <p v-if="isUserModeOrganization && patched.organizationId === null" class="error-box icon privacy">
                {{ $t('8539962c-88cc-48f1-b51d-db922ff42c04') }}
            </p>

            <STErrorsDefault :error-box="errors.errorBox" />

            <form @submit.prevent="save">
                <STInputBox v-if="firstName || lastName || usesPassword" error-fields="firstName,lastName" :error-box="errors.errorBox" :title="$t(`d9f16258-ce87-41ad-a5d4-a66ad6bd514d`)">
                    <div class="input-group">
                        <div>
                            <input v-model="firstName" class="input" type="text" autocomplete="given-name" :disabled="!usesPassword" :placeholder="$t(`ca52d8d3-9a76-433a-a658-ec89aeb4efd5`)">
                        </div>
                        <div>
                            <input v-model="lastName" class="input" type="text" autocomplete="family-name" :disabled="!usesPassword" :placeholder="$t(`171bd1df-ed4b-417f-8c5e-0546d948469a`)">
                        </div>
                    </div>
                </STInputBox>

                <EmailInput v-model="email" :validator="errors.validator" autocomplete="email" :disabled="!usesPassword" :title="$t(`7400cdce-dfb4-40e7-996b-4817385be8d8`)" :placeholder="$t(`55d8cd6e-91d1-4cbe-b9b4-f367bbf37b62`)" />

                <div v-if="usesPassword" class="style-button-bar">
                    <LoadingButton :loading="saving">
                        <button id="submit" class="button primary" type="submit" :disabled="!hasChanges">
                            <span>{{ $t('a103aa7c-4693-4bd2-b903-d14b70bfd602') }}</span>
                        </button>
                    </LoadingButton>
                </div>
            </form>

            <hr>

            <STList>
                <STListItem v-if="hasLanguages" :selectable="true" @click.prevent="switchLanguage">
                    <template #left>
                        <span class="icon language" />
                    </template>

                    <h3 class="style-title-list">
                        {{ $t('a9f552ad-87f3-4ed4-8fb6-2aea378b9665') }}
                    </h3>
                    <p class="style-description-small">
                        {{ LanguageHelper.getNativeName(I18nController.shared.language) }}
                    </p>

                    <template #right>
                        <span class="icon arrow-down-small" />
                    </template>
                </STListItem>

                <STListItem v-if="passwordEnabled" :selectable="true" @click.prevent="openChangePassword">
                    <template #left>
                        <span class="icon key" />
                    </template>

                    <h3 v-if="usesPassword" class="style-title-list">
                        {{ $t('cc1728cb-e600-4888-ad64-6ee498da11e0') }}
                    </h3>
                    <h3 v-else class="style-title-list">
                        {{ $t('2dd603e2-2caf-4573-8d8b-6ce8ff1dfda6') }}
                    </h3>
                </STListItem>

                <STListItem v-if="!usesGoogle && googleEnabled" :selectable="true" @click.prevent="connectProvider(LoginProviderType.Google)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/partners/icons/google.svg" width="24" height="24">
                    </template>

                    <h3 class="style-title-list">
                        {{ $t('e0d2207c-2f86-4f94-881e-a1696b9e463b') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t('bcd5dd71-e93e-4d19-ba21-18ff079dba55') }}
                    </p>
                </STListItem>

                <STListItem v-if="ssoEnabled && !usesSSO" :selectable="true" @click.prevent="connectProvider(LoginProviderType.SSO)">
                    <template #left>
                        <span class="icon lock" />
                    </template>

                    <h3 class="style-title-list">
                        {{ $t('9ca710ba-28cc-4008-9e10-9c61a1da3c2e', {sso: ssoConfig?.fullName || $t('662467b7-da51-4fe2-bff4-784c8f028e58') }) }}
                    </h3>
                </STListItem>

                <STListItem :selectable="true" @click.prevent="logout">
                    <template #left>
                        <span class="icon logout" />
                    </template>

                    <h3 class="style-title-list">
                        {{ $t('ecefb25b-4125-4df3-883b-73ddc301529e') }}
                    </h3>
                </STListItem>

                <STListItem :selectable="true" @click.prevent="deleteRequest">
                    <template #left>
                        <LoadingButton>
                            <span class="icon trash red" />
                        </LoadingButton>
                    </template>

                    <h3 class="style-title-list red">
                        {{ $t('1a202159-1cde-460c-b30e-8369cb6d34b7') }}
                    </h3>
                </STListItem>
            </STList>

            <template v-if="policies.length">
                <p class="style-button-bar">
                    <a v-for="policy of policies" :key="policy.id" class="button text" type="button" :href="policy.url" target="_blank">
                        <span>{{ policy.name }}</span>
                    </a>
                </p>
            </template>

            <div v-if="googleConfig && googleEnabled && usesGoogle && (passwordEnabled || ssoEnabled)" class="container">
                <hr><h2>{{ googleConfig.fullName || 'Inloggen met Google' }}</h2>
                <p>{{ $t('25f4a491-db39-43e0-9424-96217321efc7') }}</p>

                <STList>
                    <STListItem :selectable="true" @click.prevent="disconnectProvider(LoginProviderType.Google)">
                        <template #left>
                            <figure class="style-image-with-icon gray">
                                <figure>
                                    <img src="@stamhoofd/assets/images/partners/icons/google.svg">
                                </figure>
                                <aside>
                                    <span class="icon canceled small red stroke" />
                                </aside>
                            </figure>
                        </template>

                        <h3 class="style-title-list">
                            {{ $t('0fdf16ae-29b4-4524-be32-dcbd571944df') }}
                        </h3>
                    </STListItem>
                </STList>
            </div>

            <div v-if="ssoConfig && ssoEnabled && usesSSO && (passwordEnabled || googleEnabled)" class="container">
                <hr><h2>{{ ssoConfig.fullName || 'Single-Sign-On (SSO)' }}</h2>
                <p>{{ $t('a1be09e1-a95a-4597-977a-a062e46bc76e', {sso: ssoConfig.shortName || 'SSO'}) }}</p>

                <STList>
                    <STListItem :selectable="true" @click.prevent="disconnectProvider(LoginProviderType.SSO)">
                        <template #left>
                            <figure class="style-image-with-icon">
                                <figure>
                                    <span class="icon lock" />
                                </figure>
                                <aside>
                                    <span class="icon canceled small red stroke" />
                                </aside>
                            </figure>
                        </template>

                        <h3 class="style-title-list">
                            {{ $t('1b6b261b-b5d1-4f61-96f9-a4ce241e5e02', {sso: ssoConfig.shortName || 'SSO'}) }}
                        </h3>
                    </STListItem>
                </STList>
            </div>

            <div v-if="passwordEnabled && usesPassword && (usesGoogle || usesSSO)" class="container">
                <hr><h2>{{ $t('a3face2a-de93-4388-bd47-675901902508') }}</h2>
                <p>{{ $t('ea51eb19-b496-4663-9404-bb1a14385bbd') }}</p>

                <STList>
                    <STListItem :selectable="true" @click.prevent="deletePassword">
                        <template #left>
                            <figure class="style-image-with-icon error">
                                <figure>
                                    <span class="icon key" />
                                </figure>
                                <aside>
                                    <span class="icon canceled small red stroke" />
                                </aside>
                            </figure>
                        </template>

                        <h3 class="style-title-list">
                            {{ $t('a7ca7ce4-b5e8-471a-b35a-63613e96c653') }}
                        </h3>
                    </STListItem>
                </STList>
            </div>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, useDismiss, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ChangePasswordView, ConfirmEmailView, EmailInput, ErrorBox, LoadingButton, STErrorsDefault, STInputBox, STNavigationBar, Toast, useContext, useErrors, useLoginMethod, useLoginMethodEnabled, usePatch, usePlatform, useUser, useValidation } from '@stamhoofd/components';
import { I18nController } from '@stamhoofd/frontend-i18n';
import { LoginHelper } from '@stamhoofd/networking';
import { LanguageHelper, LoginMethod, LoginProviderType, NewUser, UserMeta } from '@stamhoofd/structures';
import { computed, onMounted, ref } from 'vue';
import DeleteView from './DeleteView.vue';
import { useSwitchLanguage } from './hooks/useSwitchLanguage';

const $context = useContext();
const $platform = usePlatform();
const $user = useUser();
const errors = useErrors();
const present = usePresent();
const dismiss = useDismiss();
const pop = usePop();

const { patched, addPatch, hasChanges, patch } = usePatch($user.value!);

const email = computed({
    get: () => patched.value.email,
    set: (email) => {
        addPatch({ email });
    },
});

const passwordEnabled = useLoginMethodEnabled(email, LoginMethod.Password);
const ssoEnabled = useLoginMethodEnabled(email, LoginMethod.SSO);
const googleEnabled = useLoginMethodEnabled(email, LoginMethod.Google);
const { hasLanguages, switchLanguage } = useSwitchLanguage();

const ssoConfig = useLoginMethod(LoginMethod.SSO);
const googleConfig = useLoginMethod(LoginMethod.Google);

const usesGoogle = computed(() => {
    return googleEnabled.value && ($user.value?.meta?.loginProviderIds.has(LoginProviderType.Google) ?? false);
});
const usesPassword = computed(() => {
    return passwordEnabled.value && ($user.value?.hasPassword ?? false);
});
const usesSSO = computed(() => {
    return ssoEnabled.value && ($user.value?.meta?.loginProviderIds.has(LoginProviderType.SSO) ?? false);
});

const isUserModeOrganization = STAMHOOFD.userMode === 'organization';
const saving = ref(false);
const policies = computed(() => $platform.value.config.privacy.policies);

onMounted(() => {
    $context.value.fetchUser(false).catch(console.error);
});

const firstName = computed({
    get: () => patched.value.firstName,
    set: (firstName) => {
        addPatch({ firstName });
    },
});

const lastName = computed({
    get: () => patched.value.lastName,
    set: (lastName) => {
        addPatch({ lastName });
    },
});

useValidation(errors.validator, () => {
    const se = new SimpleErrors();

    if (se.errors.length > 0) {
        errors.errorBox = new ErrorBox(se);
        return false;
    }

    errors.errorBox = null;
    return true;
});

async function save() {
    if (saving.value) {
        return;
    }

    const isValid = await errors.validator.validate();

    if (!isValid) {
        return;
    }

    saving.value = true;

    try {
        const result = await LoginHelper.patchUser($context.value, patch.value);

        if (result.verificationToken) {
            await present(new ComponentWithProperties(ConfirmEmailView, { token: result.verificationToken, email: patched.value.email }).setDisplayStyle('sheet'));
        }
        else {
            const toast = new Toast($t(`5a1df63c-b028-4a77-a2bf-d595a74f29a3`), 'success green');
            toast.show();
        }

        await dismiss({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    finally {
        saving.value = false;
    }
}

async function deleteRequest() {
    const user = $user.value;
    if (!user) {
        return;
    }

    const confirmationCode = user.email;

    await present({
        components: [
            new ComponentWithProperties(DeleteView, {
                title: $t(`de26c235-6736-40b9-880a-82046fc2da66`),
                description: $t(`4bbc8b26-74b8-43e2-95e7-86fa00ca517b`),
                confirmationTitle: $t(`6d4c71ba-0757-4792-aab1-a0b7b80e7c30`),
                confirmationPlaceholder: $t(`6a5dd477-ac82-48a1-9b7a-341192783e22`),
                confirmationCode,
                checkboxText: $t(`b0427a33-f98d-439d-8625-0727c3cf53c3`),
                onDelete: async () => {
                    await $context.value.deleteAccount();

                    Toast.success($t(`df74b936-f96f-4853-9bce-57239b3263f3`)).show();
                    await pop({ force: true });
                    return true;
                },
            }),
        ],
        modalDisplayStyle: 'sheet',
    });
}

async function openChangePassword() {
    await present(new ComponentWithProperties(ChangePasswordView, {}).setDisplayStyle('sheet'));
}

let disconnecting = false;

async function disconnectProvider(provider: LoginProviderType) {
    if (disconnecting) {
        return;
    }
    disconnecting = true;

    if (await CenteredMessage.confirm($t(`5f824a9b-6fda-4aa2-be1b-eca5c82eccef`), $t(`188ff806-6983-4912-ae35-b11e2621c5b5`))) {
        const metaPatch = UserMeta.patch({});
        metaPatch.loginProviderIds.set(provider, null);

        const patch = NewUser.patch({
            id: $user.value!.id,
            meta: metaPatch,
        });

        errors.errorBox = null;

        try {
            await LoginHelper.patchUser($context.value, patch);
            Toast.success($t(`3772eed6-90ea-45a9-90bc-f895f4c80651`)).show();
        }
        catch (e) {
            errors.errorBox = new ErrorBox(e);
        }
    }
    disconnecting = false;
}

async function deletePassword() {
    if (await CenteredMessage.confirm($t(`a5f68615-9c65-4a37-bfb2-dae9774c912c`), $t(`3e204a5f-3198-4125-ac32-fcf973e144b2`))) {
        const patch = NewUser.patch({
            id: $user.value!.id,
            hasPassword: false,
        });

        errors.errorBox = null;

        try {
            await LoginHelper.patchUser($context.value, patch);
            Toast.success($t(`06d6ec0d-c5d9-4251-a749-23c400e61905`)).show();
        }
        catch (e) {
            errors.errorBox = new ErrorBox(e);
        }
    }
}

const connecting = ref(false);

async function connectProvider(provider: LoginProviderType) {
    if (connecting.value) {
        return;
    }
    connecting.value = true;

    if (await CenteredMessage.confirm($t(`5fb8075f-4599-406c-a90e-4923be523a0a`), $t(`4b2b58ff-d6fc-46c9-8a99-638b1ce2b0d4`))) {
        // This will redirect, so the loading will stay forever
        await $context.value.startSSO({
            providerType: provider,
        });
    }
    connecting.value = false;
}

async function logout() {
    if (await CenteredMessage.confirm($t(`034eed1e-a6b2-41ee-8ca1-b6bdacbd0d9c`), $t(`e3398474-26b0-49d4-9f64-bae38495fb4f`))) {
        // Prevent auto sign in via sso
        try {
            sessionStorage.setItem('triedLogin', 'true');
        }
        catch (e) {
            // Ignore error
            console.error(e);
        }
        await $context.value.logout();
        await pop({ force: true });
    }
}

async function switchAccount() {
    await $context.value.logout(false);

    // Redirect to login
    $context.value.startSSO({
        prompt: 'select_account',
        providerType: LoginProviderType.SSO,
    }).catch(console.error);
}

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm($t('2199906b-9125-4838-8ffc-3d88a47681d1'), $t('106b3169-6336-48b8-8544-4512d42c4fd6'));
};

defineExpose({
    shouldNavigateAway,
});
</script>
