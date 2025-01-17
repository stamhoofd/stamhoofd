<template>
    <div id="account-view" class="st-view">
        <STNavigationBar title="Mijn account" />

        <main class="center">
            <h1>
                Mijn account
            </h1>
            <p>Met een account kan je één of meerdere leden beheren.</p>

            <p v-if="isUserModeOrganization && patched.organizationId === null" class="error-box icon privacy">
                Dit is een platform account
            </p>

            <STErrorsDefault :error-box="errors.errorBox" />

            <form @submit.prevent="save">
                <STInputBox v-if="firstName || lastName || usesPassword" title="Mijn naam" error-fields="firstName,lastName" :error-box="errors.errorBox">
                    <div class="input-group">
                        <div>
                            <input v-model="firstName" class="input" type="text" placeholder="Voornaam" autocomplete="given-name" :disabled="!usesPassword">
                        </div>
                        <div>
                            <input v-model="lastName" class="input" type="text" placeholder="Achternaam" autocomplete="family-name" :disabled="!usesPassword">
                        </div>
                    </div>
                </STInputBox>

                <EmailInput v-model="email" title="E-mailadres" :validator="errors.validator" placeholder="Vul jouw e-mailadres hier in" autocomplete="email" :disabled="!usesPassword" />

                <div v-if="usesPassword" class="style-button-bar">
                    <LoadingButton :loading="saving">
                        <button id="submit" class="button primary" type="submit" :disabled="!hasChanges">
                            <span>Opslaan</span>
                        </button>
                    </LoadingButton>
                </div>
            </form>

            <hr>

            <STList>
                <STListItem v-if="passwordEnabled" :selectable="true" @click.prevent="openChangePassword">
                    <template #left>
                        <span class="icon key" />
                    </template>

                    <h3 v-if="usesPassword" class="style-title-list">
                        Wachtwoord wijzigen
                    </h3>
                    <h3 v-else class="style-title-list">
                        Wachtwoord instellen
                    </h3>
                </STListItem>

                <STListItem v-if="!usesGoogle && googleEnabled" :selectable="true" @click.prevent="connectProvider(LoginProviderType.Google)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/partners/icons/google.svg" width="24" height="24">
                    </template>

                    <h3 class="style-title-list">
                        Google account koppelen
                    </h3>
                    <p class="style-description-small">
                        Je kan dan inloggen via je Google account als alternatieve loginmethode
                    </p>
                </STListItem>

                <STListItem v-if="ssoEnabled && !usesSSO" :selectable="true" @click.prevent="connectProvider(LoginProviderType.SSO)">
                    <template #left>
                        <span class="icon lock" />
                    </template>

                    <h3 class="style-title-list">
                        {{ ssoConfig.fullName || 'Single-Sign-On (SSO)' }} activeren
                    </h3>
                </STListItem>

                <STListItem :selectable="true" @click.prevent="logout">
                    <template #left>
                        <span class="icon logout" />
                    </template>

                    <h3 class="style-title-list">
                        Uitloggen
                    </h3>
                </STListItem>

                <STListItem :selectable="true" @click.prevent="deleteRequest">
                    <template #left>
                        <LoadingButton>
                            <span class="icon trash red" />
                        </LoadingButton>
                    </template>

                    <h3 class="style-title-list red">
                        Account verwijderen
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
                <hr>
                <h2>{{ googleConfig.fullName || 'Inloggen met Google' }}</h2>
                <p>Je gebruikt Google om in te loggen op jouw account. Je kan inloggen met Google deactiveren voor jouw account.</p>

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
                            Google deactiveren
                        </h3>
                    </STListItem>
                </STList>
            </div>

            <div v-if="ssoConfig && ssoEnabled && usesSSO && (passwordEnabled || googleEnabled)" class="container">
                <hr>
                <h2>{{ ssoConfig.fullName || 'Single-Sign-On (SSO)' }}</h2>
                <p>Je gebruikt {{ ssoConfig.shortName || 'SSO' }} om in te loggen op jouw account. Als je wilt kan je die inlogmethode deactiveren voor jouw account.</p>

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
                            {{ ssoConfig.shortName || 'SSO' }} deactiveren
                        </h3>
                    </STListItem>
                </STList>
            </div>

            <div v-if="passwordEnabled && usesPassword && (usesGoogle || usesSSO)" class="container">
                <hr>
                <h2>Inloggen met wachtwoord</h2>
                <p>Je kan momenteel ook inloggen met een wachtwoord op je account. Als je wilt kan je jouw wachtwoord verwijderen zodat je enkel via je andere ingestelde loginmethode kan inloggen.</p>

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
                            Wachtwoord verwijderen
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
