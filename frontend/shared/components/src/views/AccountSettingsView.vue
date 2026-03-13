<template>
    <div id="account-view" class="st-view">
        <STNavigationBar :title="$t('%E')" />

        <main class="center">
            <h1>
                {{ $t("%E") }}
            </h1>
            <p>{{ $t('%jj') }}</p>

            <p v-if="isUserModeOrganization && patched.organizationId === null" class="error-box icon privacy">
                {{ $t('%jk') }}
            </p>

            <STErrorsDefault :error-box="errors.errorBox" />

            <form @submit.prevent="save" novalidate>
                <STInputBox v-if="firstName || lastName || usesPassword" error-fields="firstName,lastName" :error-box="errors.errorBox" :title="$t(`%jx`)">
                    <div class="input-group">
                        <div>
                            <input v-model="firstName" class="input" type="text" autocomplete="given-name" :disabled="!usesPassword" :placeholder="$t(`%1MT`)">
                        </div>
                        <div>
                            <input v-model="lastName" class="input" type="text" autocomplete="family-name" :disabled="!usesPassword" :placeholder="$t(`%1MU`)">
                        </div>
                    </div>
                </STInputBox>

                <EmailInput v-model="email" :validator="errors.validator" autocomplete="email" :disabled="!usesPassword" :title="$t(`%1FK`)" :placeholder="$t(`%WT`)" />

                <div v-if="usesPassword" class="style-button-bar">
                    <LoadingButton :loading="saving">
                        <button id="submit" class="button primary" type="submit" :disabled="!hasChanges">
                            <span>{{ $t('%v7') }}</span>
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
                        {{ $t('%14d') }}
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
                        {{ $t('%uu') }}
                    </h3>
                    <h3 v-else class="style-title-list">
                        {{ $t('%jl') }}
                    </h3>
                </STListItem>

                <STListItem v-if="!usesGoogle && googleEnabled" :selectable="true" @click.prevent="connectProvider(LoginProviderType.Google)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/partners/icons/google.svg" width="24" height="24">
                    </template>

                    <h3 class="style-title-list">
                        {{ $t('%jm') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t('%jn') }}
                    </p>
                </STListItem>

                <STListItem v-if="ssoEnabled && !usesSSO" :selectable="true" @click.prevent="connectProvider(LoginProviderType.SSO)">
                    <template #left>
                        <span class="icon lock" />
                    </template>

                    <h3 class="style-title-list">
                        {{ $t('%jo', {sso: ssoConfig?.fullName || $t('%2b') }) }}
                    </h3>
                </STListItem>

                <STListItem :selectable="true" @click.prevent="logout">
                    <template #left>
                        <span class="icon logout" />
                    </template>

                    <h3 class="style-title-list">
                        {{ $t('%12N') }}
                    </h3>
                </STListItem>

                <STListItem :selectable="true" @click.prevent="deleteRequest">
                    <template #left>
                        <LoadingButton>
                            <span class="icon trash red" />
                        </LoadingButton>
                    </template>

                    <h3 class="style-title-list red">
                        {{ $t('%jp') }}
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
                <hr><h2>{{ googleConfig.fullName || $t('%15b') }}</h2>
                <p>{{ $t('%jq') }}</p>

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
                            {{ $t('%jr') }}
                        </h3>
                    </STListItem>
                </STList>
            </div>

            <div v-if="ssoConfig && ssoEnabled && usesSSO && (passwordEnabled || googleEnabled)" class="container">
                <hr><h2>{{ ssoConfig.fullName || 'Single-Sign-On (SSO)' }}</h2>
                <p>{{ $t('%js', {sso: ssoConfig.shortName || 'SSO'}) }}</p>

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
                            {{ $t('%jt', {sso: ssoConfig.shortName || 'SSO'}) }}
                        </h3>
                    </STListItem>
                </STList>
            </div>

            <div v-if="passwordEnabled && usesPassword && (usesGoogle || usesSSO)" class="container">
                <hr><h2>{{ $t('%ju') }}</h2>
                <p>{{ $t('%jv') }}</p>

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
                            {{ $t('%jw') }}
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
import { CenteredMessage } from '#overlays/CenteredMessage.ts';
import ChangePasswordView from '#views/ChangePasswordView.vue';
import ConfirmEmailView from '#auth/ConfirmEmailView.vue';
import EmailInput from '#inputs/EmailInput.vue';
import { ErrorBox } from '#errors/ErrorBox.ts';
import LoadingButton from '#navigation/LoadingButton.vue';
import STErrorsDefault from '#errors/STErrorsDefault.vue';
import STInputBox from '#inputs/STInputBox.vue';
import STNavigationBar from '#navigation/STNavigationBar.vue';
import { Toast } from '#overlays/Toast.ts';
import { useContext } from '#hooks/useContext.ts';
import { useErrors } from '#errors/useErrors.ts';
import { useLoginMethod, useLoginMethodEnabled } from '#hooks/useLoginMethods.ts';
import { usePatch } from '#hooks/usePatch.ts';
import { usePlatform } from '#hooks/usePlatform.ts';
import { useUser } from '#hooks/useUser.ts';
import { useValidation } from '#errors/useValidation.ts';
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
            const toast = new Toast($t(`%HA`), 'success green');
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
                title: $t(`%12B`),
                description: $t(`%15a`),
                confirmationTitle: $t(`%12C`),
                confirmationPlaceholder: $t(`%12D`),
                confirmationCode,
                checkboxText: $t(`%6P`),
                onDelete: async () => {
                    await $context.value.deleteAccount();

                    Toast.success($t(`%12E`)).show();
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

    if (await CenteredMessage.confirm($t(`%12F`), $t(`%12G`))) {
        const metaPatch = UserMeta.patch({});
        metaPatch.loginProviderIds.set(provider, null);

        const patch = NewUser.patch({
            id: $user.value!.id,
            meta: metaPatch,
        });

        errors.errorBox = null;

        try {
            await LoginHelper.patchUser($context.value, patch);
            Toast.success($t(`%12H`)).show();
        }
        catch (e) {
            errors.errorBox = new ErrorBox(e);
        }
    }
    disconnecting = false;
}

async function deletePassword() {
    if (await CenteredMessage.confirm($t(`%12I`), $t(`%55`))) {
        const patch = NewUser.patch({
            id: $user.value!.id,
            hasPassword: false,
        });

        errors.errorBox = null;

        try {
            await LoginHelper.patchUser($context.value, patch);
            Toast.success($t(`%12J`)).show();
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

    if (await CenteredMessage.confirm($t(`%12K`), $t(`%12L`))) {
        // This will redirect, so the loading will stay forever
        await $context.value.startSSO({
            providerType: provider,
        });
    }
    connecting.value = false;
}

async function logout() {
    if (await CenteredMessage.confirm($t(`%12M`), $t(`%12N`))) {
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
    return await CenteredMessage.confirm($t('%A0'), $t('%4X'));
};

defineExpose({
    shouldNavigateAway,
});
</script>
