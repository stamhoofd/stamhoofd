<template>
    <form class="st-view login-view" data-submit-last-field @submit.prevent="submit">
        <STNavigationBar :large="true" class="transparent" :title="$t(`8ea6b1b7-4c8b-462d-83d7-7856cee51d6c`)" />

        <main class="center small flex">
            <div class="st-view-vertical-center">
                <div class="container">
                    <h1 v-if="STAMHOOFD.userMode === 'organization' && $context.organization">
                        {{ $t('c85603b9-d395-46d0-8df4-2b4522d08a43', {organization: $context.organization.name}) }}
                    </h1>
                    <h1 v-else>
                        {{ $t('d54c9b23-2d3c-49cd-b1fc-7e821d36fd41') }}
                    </h1>

                    <STErrorsDefault :error-box="errors.errorBox" />

                    <template v-if="passwordConfig">
                        <EmailInput id="username" ref="emailInput" v-model="email" :autofocus="!initialEmail" enterkeyhint="next" class="max" name="username" :validator="errors.validator" autocomplete="username" :disabled="lock !== null" :title="$t(`7400cdce-dfb4-40e7-996b-4817385be8d8`)" :placeholder="$t(`55d8cd6e-91d1-4cbe-b9b4-f367bbf37b62`)" />
                        <p v-if="lock" class="style-description-small">
                            {{ lock }}
                        </p>

                        <STInputBox class="max" :title="$t(`f3bcb2fd-6f56-436a-bf8d-8cde0d924d6a`)">
                            <template #right>
                                <button class="button text" type="button" tabindex="-1" @click.prevent="gotoPasswordForgot">
                                    <span>{{ $t('b8d6b8b0-5237-44ed-869d-33692571f4f4') }}</span>
                                    <span class="icon help" />
                                </button>
                            </template>
                            <input id="password" v-model="password" data-testid="password-input" :autofocus="!!initialEmail" enterkeyhint="go" class="input" name="current-password" autocomplete="current-password" type="password" :placeholder="$t(`e2cec378-4ed6-40c1-bc1b-ca93718bacf1`)" @input="(event: any) => password = event.target.value" @change="(event: any) => password = event.target.value">
                        </STInputBox>
                        <VersionFooter v-if="showVersionFooter" />
                        <div v-else class="style-form-buttons ">
                            <LoadingButton :loading="loading" class="block">
                                <button id="submit" class="button primary full" type="submit" data-testid="login-button">
                                    <span class="lock icon" />
                                    <span>{{ $t('1627a32a-56b8-4c74-8715-b885c1795af6') }}</span>
                                </button>
                            </LoadingButton>

                            <template v-if="googleConfig">
                                <button class="button secundary full" type="button" tabindex="-1" @click="startSSO(LoginProviderType.Google)">
                                    <span class="icon">
                                        <img src="@stamhoofd/assets/images/partners/icons/google.svg"></span>
                                    <span v-if="googleConfig.loginButtonText">{{ googleConfig.loginButtonText }}</span>
                                    <span v-else>{{ $t('eb3fdbca-6393-44ec-9e0d-f416c6dded10') }}</span>
                                </button>
                            </template>

                            <template v-if="ssoConfig">
                                <button class="button secundary full" type="button" tabindex="-1" @click="startSSO(LoginProviderType.SSO)">
                                    <span v-if="ssoConfig.loginButtonText">{{ ssoConfig.loginButtonText }}</span>
                                    <span v-else-if="!passwordConfig">{{ $t('1627a32a-56b8-4c74-8715-b885c1795af6') }}</span>
                                    <span v-else>{{ $t('f0f27d05-3281-4d1c-8ff5-0e84ca35114f') }}</span>
                                </button>
                            </template>
                        </div>

                        <hr><p class="style-description-small">
                            {{ $t('647ac0ed-dcb5-43d2-bd0d-4ac5839a7974') }}
                        </p>

                        <button class="button text selected" type="button" tabindex="-1" @click="openSignup">
                            <span>{{ $t('657d0ca3-739f-48bc-b4c0-b4c326b59834') }}</span>
                            <span class="icon arrow-right-small" />
                        </button>
                    </template>
                    <template v-else>
                        <p class="style-description-block">
                            {{ $t('f35f414f-7358-4f4f-8d3a-0ddc04270f47') }}
                        </p>

                        <div class="style-form-buttons">
                            <button v-if="ssoConfig" class="button primary full" type="button" tabindex="-1" @click="startSSO(LoginProviderType.SSO)">
                                <span v-if="ssoConfig.loginButtonText">{{ ssoConfig.loginButtonText }}</span>
                                <span v-else>{{ $t('1627a32a-56b8-4c74-8715-b885c1795af6') }}</span>
                            </button>
                            <button v-if="googleConfig" class="button secundary full" type="button" tabindex="-1" @click="startSSO(LoginProviderType.Google)">
                                <span class="icon">
                                    <img src="@stamhoofd/assets/images/partners/icons/google.svg"></span>
                                <span v-if="googleConfig.loginButtonText">{{ googleConfig.loginButtonText }}</span>
                                <span v-else>{{ $t('eb3fdbca-6393-44ec-9e0d-f416c6dded10') }}</span>
                            </button>
                        </div>
                    </template>
                </div>
            </div>

            <PlatformFooter />
        </main>
    </form>
</template>

<script lang="ts" setup>
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, defineRoutes, onCheckRoutes, UrlHelper, useDismiss, useNavigate, usePresent } from '@simonbackx/vue-app-navigation';
import { AppManager, LoginHelper } from '@stamhoofd/networking';
import { computed, onMounted, ref } from 'vue';

import { LoginMethod, LoginProviderType } from '@stamhoofd/structures';
import { sleep } from '@stamhoofd/utility';
import VersionFooter from '../context/VersionFooter.vue';
import { ErrorBox } from '../errors/ErrorBox';
import { useErrors } from '../errors/useErrors';
import { useContext, useLoginMethod } from '../hooks';
import EmailInput from '../inputs/EmailInput.vue';
import ConfirmEmailView from './ConfirmEmailView.vue';
import ForgotPasswordView from './ForgotPasswordView.vue';
import PlatformFooter from './PlatformFooter.vue';

const props = withDefaults(
    defineProps<{
        initialEmail?: string;
        lock?: string | null;
    }>(), {
        initialEmail: '',
        lock: null,
    },
);

enum Routes {
    ForgotPassword = 'forgotPassword',
    Signup = 'signup',
}

defineRoutes([
    {
        name: Routes.ForgotPassword,
        url: 'wachtwoord-vergeten',
        component: ForgotPasswordView as any,
        paramsToProps() {
            return {
                initialEmail: email.value,
            };
        },
    },
    {
        name: Routes.Signup,
        url: 'account-aanmaken',
        component: async () => (await import('./SignupView.vue')).default,
        paramsToProps() {
            return {
                initialEmail: email.value,
            };
        },
    },
]);

const errors = useErrors();
const $context = useContext();
const present = usePresent();
const dismiss = useDismiss();
const $navigate = useNavigate();

const loading = ref(false);
const email = ref(props.initialEmail);
const password = ref('');
const animating = ref(true);
const emailInput = ref<EmailInput | null>(null);
const showVersionFooter = computed(() => {
    return email.value.toLocaleLowerCase().trim() === 'stamhoofd@dev.dev';
});
const context = useContext();

const passwordConfig = useLoginMethod(LoginMethod.Password);
const ssoConfig = useLoginMethod(LoginMethod.SSO);
const googleConfig = useLoginMethod(LoginMethod.Google);

onCheckRoutes(() => {
    // Try to log in on first load
    try {
        if (!ssoConfig.value || passwordConfig.value || googleConfig.value) {
            return;
        }
        if (AppManager.shared.isNative) {
            return;
        }
        const search = UrlHelper.initial.getSearchParams();
        if (!sessionStorage.getItem('triedLogin') && !search.get('error') && !search.get('oid_rt')) {
            sessionStorage.setItem('triedLogin', 'true');
            startSSO(LoginProviderType.SSO, true).catch(console.error);
        }
    }
    catch (e) {
        console.error(e);
    }
});

async function startSSO(provider: LoginProviderType, automatic = false) {
    if (loading.value) {
        return;
    }

    loading.value = true;

    // This will redirect, so the loading will stay forever
    await context.value.startSSO({
        providerType: provider,
        prompt: automatic ? undefined : 'select_account',
    });

    sleep(5000).then(() => {
        // In case the redirect failed for some reason
        loading.value = false;
    }).catch(console.error);
}

async function submit() {
    if (loading.value) {
        return;
    }

    if (!passwordConfig.value) {
        if (ssoConfig.value) {
            await startSSO(LoginProviderType.SSO);
            return;
        }
        if (googleConfig.value) {
            await startSSO(LoginProviderType.Google);
            return;
        }
        return;
    }

    const valid = await errors.validator.validate();

    if (!valid) {
        return;
    }

    if (email.value.length < 3 || password.value.length < 5) {
        errors.errorBox = new ErrorBox(
            new SimpleError({
                code: 'empty_fields',
                message: 'Je hebt geen correcte gegevens ingevuld',
            }),
        );
        return;
    }

    loading.value = true;

    try {
        const result = await LoginHelper.login($context.value, email.value, password.value);

        if (email.value.toLocaleLowerCase() === 'appreview@stamhoofd.be' && STAMHOOFD.APP_UPDATE_STAGING_SERVER_URL) {
            // await Storage.keyValue.setItem('next_url_load', '/login/34541097-44dd-4c68-885e-de4f42abae4c')
            await AppManager.shared.checkUpdates({
                // Always load the staging build
                customText: $t(`a7e7f69a-3ea8-4821-983a-47b0be06b430`),
                visibleDownload: true,
                installAutomatically: true,
                force: true,
                channel: STAMHOOFD.APP_UPDATE_STAGING_SERVER_URL,
                checkTimeout: 15 * 1000,
            });
            // await Storage.keyValue.removeItem('next_url_load')
        }

        if (result.verificationToken) {
            await present({
                components: [
                    new ComponentWithProperties(ConfirmEmailView, {
                        login: true,
                        token: result.verificationToken,
                        email: email.value,
                    }),
                ],
                modalDisplayStyle: 'sheet',
            });
        }
        else {
            await dismiss({ force: true });
        }
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    loading.value = false;
}

async function gotoPasswordForgot() {
    await $navigate(Routes.ForgotPassword);
}

async function openSignup() {
    await $navigate(Routes.Signup);
}

onMounted(() => {
    if (props.initialEmail.length === 0) {
        setTimeout(() => {
            animating.value = false;
            // Needed the any here because typescript is getting mad only in production mode
            if (emailInput.value) {
                emailInput.value.focus();
            }
        }, 300);
    }
    else {
        setTimeout(() => {
            // Needed the any here because typescript is getting mad only in production mode
            animating.value = false;
        }, 300);
    }
});
</script>
