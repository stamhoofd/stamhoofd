<template>
    <form class="st-view login-view" data-testid="login-view" data-submit-last-field novalidate @submit.prevent="submit">
        <STNavigationBar :large="true" class="transparent" :title="$t(`%Qg`)" />

        <main class="center small flex">
            <div class="st-view-vertical-center">
                <div class="container">
                    <h1 v-if="STAMHOOFD.userMode === 'organization' && $context.organization">
                        {{ $t('%1Ab', {organization: $context.organization.name}) }}
                    </h1>
                    <h1 v-else>
                        {{ $t('%8') }}
                    </h1>

                    <STErrorsDefault :error-box="errors.errorBox" />

                    <template v-if="passwordConfig">
                        <EmailInput id="username" ref="emailInput" v-model="email" :autofocus="!initialEmail" enterkeyhint="next" class="max" name="username" :validator="errors.validator" autocomplete="username" :disabled="lock !== null" :title="$t(`%1FK`)" :placeholder="$t(`%WT`)" />
                        <p v-if="lock" class="style-description-small">
                            {{ lock }}
                        </p>

                        <STInputBox class="max" :title="$t(`%HK`)">
                            <template #right>
                                <button class="button text" type="button" tabindex="-1" @click.prevent="gotoPasswordForgot">
                                    <span>{{ $t('%Zj') }}</span>
                                    <span class="icon help" />
                                </button>
                            </template>
                            <input id="password" v-model="password" data-testid="password-input" :autofocus="!!initialEmail" enterkeyhint="go" class="input" name="current-password" autocomplete="current-password" type="password" :placeholder="$t(`%Zn`)" @input="(event: any) => password = event.target.value" @change="(event: any) => password = event.target.value">
                        </STInputBox>
                        <VersionFooter v-if="showVersionFooter" />
                        <div v-else class="style-form-buttons ">
                            <LoadingButton :loading="loading" class="block">
                                <button id="submit" class="button primary full" type="submit" data-testid="login-button">
                                    <span class="lock icon" />
                                    <span>{{ $t('%Qg') }}</span>
                                </button>
                            </LoadingButton>

                            <LoginMethodButton v-if="googleConfig" :config="googleConfig" :provider="LoginProviderType.Google" tabindex="-1" @click="startSSO(LoginProviderType.Google)" />

                            <LoginMethodButton v-if="ssoConfig" :config="ssoConfig" :provider="LoginProviderType.SSO" :fallback-text="!passwordConfig ? $t('%Qg') : $t('%Zk')" tabindex="-1" @click="startSSO(LoginProviderType.SSO)" />
                        </div>

                        <hr><p class="style-description-small">
                            {{ $t('%Zl') }}
                        </p>

                        <button class="button text selected" type="button" tabindex="-1" data-testid="signup-account-link" @click="openSignup">
                            <span>{{ $t('%ur') }}</span>
                            <span class="icon arrow-right-small" />
                        </button>
                    </template>
                    <template v-else>
                        <p class="style-description-block">
                            {{ $t('%Zm') }}
                        </p>

                        <div class="style-form-buttons">
                            <LoginMethodButton v-if="ssoConfig" :config="ssoConfig" :provider="LoginProviderType.SSO" :primary="true" :fallback-text="$t('%Qg')" tabindex="-1" @click="startSSO(LoginProviderType.SSO)" />
                            <LoginMethodButton v-if="googleConfig" :config="googleConfig" :provider="LoginProviderType.Google" tabindex="-1" @click="startSSO(LoginProviderType.Google)" />
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
import { defineRoutes, onCheckRoutes, UrlHelper, useNavigate } from '@simonbackx/vue-app-navigation';
import { AppManager } from '@stamhoofd/networking/AppManager';
import { LoginHelper } from '@stamhoofd/networking/LoginHelper';
import { computed, ref } from 'vue';

import { AppRoute, LoginMethod, LoginProviderType } from '@stamhoofd/structures';
import { sleep } from '@stamhoofd/utility';
import VersionFooter from '../context/VersionFooter.vue';
import { ErrorBox } from '../errors/ErrorBox';
import { useErrors } from '../errors/useErrors';
import { useAppNavigate } from '../hooks/useAppNavigate.ts';
import { useContext } from '../hooks/useContext.ts';
import { useLoginMethod } from '../hooks/useLoginMethods.ts';

import EmailInput from '../inputs/EmailInput.vue';

import LoginMethodButton from './LoginMethodButton.vue';
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
        component: async () => (await import('./ForgotPasswordView.vue')).default,
        defaultProperties() {
            return {
                initialEmail: email.value,
            };
        },
    },
    {
        name: Routes.Signup,
        url: 'account-aanmaken',
        component: async () => (await import('./SignupView.vue')).default,
        defaultProperties() {
            return {
                initialEmail: email.value,
            };
        },
    },
]);

const errors = useErrors();
const $context = useContext();
const $navigate = useNavigate();
const appNavigate = useAppNavigate();

const loading = ref(false);
const email = ref(props.initialEmail);
const password = ref('');
const emailInput = ref<InstanceType<typeof EmailInput> | null>(null);
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
    } catch (e) {
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
                message: $t('%1Xg'),
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
                customText: $t(`%v1`),
                visibleDownload: true,
                installAutomatically: true,
                force: true,
                channel: STAMHOOFD.APP_UPDATE_STAGING_SERVER_URL,
                checkTimeout: 15 * 1000,
            });
            // await Storage.keyValue.removeItem('next_url_load')
        }

        if (result.verificationToken) {
            await appNavigate(AppRoute.VerifyEmail, {
                properties: {
                    token: result.verificationToken,
                    email: email.value,
                    organization: $context.value.organization,
                },
                adjustHistory: false,
            });
        }
    } catch (e) {
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

</script>
