<template>
    <div id="account-view" class="st-view">
        <STNavigationBar :title="$t('a48e6035-5e61-4fc7-9ac4-89016e7174fe')"/>

        <main class="center">
            <h1>
                {{ $t("a48e6035-5e61-4fc7-9ac4-89016e7174fe") }}
            </h1>
            <p>{{ $t('49c8c2a6-8221-4e0a-a3b6-989a671b7fbf') }}</p>

            <p v-if="isUserModeOrganization && patched.organizationId === null" class="error-box icon privacy">
                {{ $t('8218ccea-4dc3-4da6-8a02-3a959bcbbd81') }}
            </p>

            <STErrorsDefault :error-box="errors.errorBox"/>

            <form @submit.prevent="save">
                <STInputBox v-if="firstName || lastName || usesPassword" error-fields="firstName,lastName" :error-box="errors.errorBox" :title="$t(`983f617e-682f-41c3-a156-760e8e3734c1`)">
                    <div class="input-group">
                        <div>
                            <input v-model="firstName" class="input" type="text" autocomplete="given-name" :disabled="!usesPassword" :placeholder="$t(`883f9695-e18f-4df6-8c0d-651c6dd48e59`)"></div>
                        <div>
                            <input v-model="lastName" class="input" type="text" autocomplete="family-name" :disabled="!usesPassword" :placeholder="$t(`f89d8bfa-6b5d-444d-a40f-ec17b3f456ee`)"></div>
                    </div>
                </STInputBox>

                <EmailInput v-model="email" :validator="errors.validator" autocomplete="email" :disabled="!usesPassword" :title="$t(`0be79160-b242-44dd-94f0-760093f7f9f2`)" :placeholder="$t(`0a65c7be-dcc1-4bf7-9c6e-560085de9052`)"/>

                <div v-if="usesPassword" class="style-button-bar">
                    <LoadingButton :loading="saving">
                        <button id="submit" class="button primary" type="submit" :disabled="!hasChanges">
                            <span>{{ $t('bd7fc57f-7ba8-4011-8557-a720a55ecc6f') }}</span>
                        </button>
                    </LoadingButton>
                </div>
            </form>

            <hr><STList>
                <STListItem v-if="passwordEnabled" :selectable="true" @click.prevent="openChangePassword">
                    <template #left>
                        <span class="icon key"/>
                    </template>

                    <h3 v-if="usesPassword" class="style-title-list">
                        {{ $t('55f44c6c-4d38-480a-805f-2378d2ca4319') }}
                    </h3>
                    <h3 v-else class="style-title-list">
                        {{ $t('f7b5c0dc-2c0e-4b7a-9422-af08f0b520dc') }}
                    </h3>
                </STListItem>

                <STListItem v-if="!usesGoogle && googleEnabled" :selectable="true" @click.prevent="connectProvider(LoginProviderType.Google)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/partners/icons/google.svg" width="24" height="24"></template>

                    <h3 class="style-title-list">
                        {{ $t('468c6d67-0923-441e-aebe-9a1542e864e8') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t('c37d2fc0-e292-4d8a-93df-202a1b9a7470') }}
                    </p>
                </STListItem>

                <STListItem v-if="ssoEnabled && !usesSSO" :selectable="true" @click.prevent="connectProvider(LoginProviderType.SSO)">
                    <template #left>
                        <span class="icon lock"/>
                    </template>

                    <h3 class="style-title-list">
                        {{ ssoConfig.fullName || 'Single-Sign-On (SSO)' }} {{ $t('187bc631-a8d9-4baf-a281-603fc5bbb01f') }}
                    </h3>
                </STListItem>

                <STListItem :selectable="true" @click.prevent="logout">
                    <template #left>
                        <span class="icon logout"/>
                    </template>

                    <h3 class="style-title-list">
                        {{ $t('79031faf-6e60-4268-a65f-56336ff98c04') }}
                    </h3>
                </STListItem>

                <STListItem :selectable="true" @click.prevent="deleteRequest">
                    <template #left>
                        <LoadingButton>
                            <span class="icon trash red"/>
                        </LoadingButton>
                    </template>

                    <h3 class="style-title-list red">
                        {{ $t('5153e870-6ffa-40c9-9e15-50a2b8ae65c3') }}
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
                <p>{{ $t('3dba335c-efb0-4810-94f9-c41a6123d836') }}</p>

                <STList>
                    <STListItem :selectable="true" @click.prevent="disconnectProvider(LoginProviderType.Google)">
                        <template #left>
                            <figure class="style-image-with-icon gray">
                                <figure>
                                    <img src="@stamhoofd/assets/images/partners/icons/google.svg"></figure>
                                <aside>
                                    <span class="icon canceled small red stroke"/>
                                </aside>
                            </figure>
                        </template>

                        <h3 class="style-title-list">
                            {{ $t('b980dfe0-e79b-44f9-8684-e4b6a3b69b63') }}
                        </h3>
                    </STListItem>
                </STList>
            </div>

            <div v-if="ssoConfig && ssoEnabled && usesSSO && (passwordEnabled || googleEnabled)" class="container">
                <hr><h2>{{ ssoConfig.fullName || 'Single-Sign-On (SSO)' }}</h2>
                <p>{{ $t('df77059d-b6a1-43b6-b290-e260d9d5a404') }} {{ ssoConfig.shortName || 'SSO' }} {{ $t('de510f29-e0b8-440f-81ee-e48e2fe00ce8') }}</p>

                <STList>
                    <STListItem :selectable="true" @click.prevent="disconnectProvider(LoginProviderType.SSO)">
                        <template #left>
                            <figure class="style-image-with-icon">
                                <figure>
                                    <span class="icon lock"/>
                                </figure>
                                <aside>
                                    <span class="icon canceled small red stroke"/>
                                </aside>
                            </figure>
                        </template>

                        <h3 class="style-title-list">
                            {{ ssoConfig.shortName || 'SSO' }} {{ $t('bc0a1db5-8adf-4441-b24d-847c2c5436d3') }}
                        </h3>
                    </STListItem>
                </STList>
            </div>

            <div v-if="passwordEnabled && usesPassword && (usesGoogle || usesSSO)" class="container">
                <hr><h2>{{ $t('d2b00776-0c2b-45df-8897-2c925da99066') }}</h2>
                <p>{{ $t('56aa4d51-0393-4751-8411-38d3b8999f30') }}</p>

                <STList>
                    <STListItem :selectable="true" @click.prevent="deletePassword">
                        <template #left>
                            <figure class="style-image-with-icon error">
                                <figure>
                                    <span class="icon key"/>
                                </figure>
                                <aside>
                                    <span class="icon canceled small red stroke"/>
                                </aside>
                            </figure>
                        </template>

                        <h3 class="style-title-list">
                            {{ $t('fb3516f1-ccab-42fe-8bee-8eaec61e5d90') }}
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
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { LoginHelper } from '@stamhoofd/networking';
import { LoginMethod, LoginProviderType, NewUser, UserMeta } from '@stamhoofd/structures';
import { computed, onMounted, ref } from 'vue';
import DeleteView from './DeleteView.vue';

const $context = useContext();
const $platform = usePlatform();
const $user = useUser();
const errors = useErrors();
const present = usePresent();
const dismiss = useDismiss();
const pop = usePop();
const $t = useTranslate();
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
            const toast = new Toast('De wijzigingen zijn opgeslagen', 'success green');
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
                title: 'Verwijder jouw account?',
                description: `Ben je 100% zeker dat je jouw account wilt verwijderen? Vul dan je huidige e-mailadres in ter bevestiging. Al jouw gegevens gaan verloren. Je kan dit niet ongedaan maken.`,
                confirmationTitle: 'Bevestig je e-mailadres',
                confirmationPlaceholder: 'Huidige e-mailadres',
                confirmationCode,
                checkboxText: 'Ja, ik ben 100% zeker',
                onDelete: async () => {
                    await $context.value.deleteAccount();

                    Toast.success('Je account is verwijderd. Het kan even duren voor jouw aanvraag volledig is verwerkt.').show();
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

    if (await CenteredMessage.confirm('Ben je zeker dat je deze inlogmethode wilt deactiveren?', 'Ja, deactiveren')) {
        const metaPatch = UserMeta.patch({});
        metaPatch.loginProviderIds.set(provider, null);

        const patch = NewUser.patch({
            id: $user.value!.id,
            meta: metaPatch,
        });

        errors.errorBox = null;

        try {
            await LoginHelper.patchUser($context.value, patch);
            Toast.success('De inlogmethode is ontkoppeld').show();
        }
        catch (e) {
            errors.errorBox = new ErrorBox(e);
        }
    }
    disconnecting = false;
}

async function deletePassword() {
    if (await CenteredMessage.confirm('Ben je zeker dat je jouw wachtwoord wilt verwijderen?', 'Ja, verwijderen')) {
        const patch = NewUser.patch({
            id: $user.value!.id,
            hasPassword: false,
        });

        errors.errorBox = null;

        try {
            await LoginHelper.patchUser($context.value, patch);
            Toast.success('Je wachtwoord is verwijderd').show();
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

    if (await CenteredMessage.confirm('Ben je zeker dat je deze inlogmethode wilt koppelen?', 'Ja, koppelen')) {
        // This will redirect, so the loading will stay forever
        await $context.value.startSSO({
            providerType: provider,
        });
    }
    connecting.value = false;
}

async function logout() {
    if (await CenteredMessage.confirm('Ben je zeker dat je wilt uitloggen?', 'Uitloggen')) {
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
