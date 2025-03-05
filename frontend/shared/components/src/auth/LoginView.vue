<template>
    <form class="st-view login-view" data-submit-last-field @submit.prevent="submit">
        <STNavigationBar :large="true" class="transparent" :title="$t(`Inloggen`)"/>

        <main class="center small flex">
            <div class="st-view-vertical-center">
                <div class="container">
                    <h1>{{ $t('d54c9b23-2d3c-49cd-b1fc-7e821d36fd41') }}</h1>

                    <STErrorsDefault :error-box="errors.errorBox"/>

                    <template v-if="passwordConfig">
                        <EmailInput id="username" ref="emailInput" v-model="email" :autofocus="!initialEmail" enterkeyhint="next" class="max" name="username" :validator="errors.validator" autocomplete="username" :disabled="lock !== null" :title="$t(`0be79160-b242-44dd-94f0-760093f7f9f2`)" :placeholder="$t(`0a65c7be-dcc1-4bf7-9c6e-560085de9052`)"/>
                        <p v-if="lock" class="style-description-small">
                            {{ lock }}
                        </p>

                        <STInputBox class="max" :title="$t(`032759a7-e6d6-429e-b4f0-5b8c6b1ae6dd`)">
                            <template #right>
                                <button class="button text" type="button" tabindex="-1" @click.prevent="gotoPasswordForgot">
                                    <span>{{ $t('c62d31cd-a064-483a-84d5-97f6f479bc15') }}</span>
                                    <span class="icon help"/>
                                </button>
                            </template>
                            <input id="password" v-model="password" :autofocus="!!initialEmail" enterkeyhint="go" class="input" name="current-password" autocomplete="current-password" type="password" @input="(event) => password = event.target.value" @change="(event) => password = event.target.value" :placeholder="$t(`0f6aae79-7c28-4214-9acf-69693ca82e48`)"></STInputBox>
                        <VersionFooter v-if="showVersionFooter"/>
                        <div v-else class="style-form-buttons ">
                            <LoadingButton :loading="loading" class="block">
                                <button id="submit" class="button primary full" type="submit">
                                    <span class="lock icon"/>
                                    <span>{{ $t('e146434b-e70f-44de-85d3-6b80dbc21041') }}</span>
                                </button>
                            </LoadingButton>

                            <template v-if="googleConfig">
                                <button class="button secundary full" type="button" tabindex="-1" @click="startSSO(LoginProviderType.Google)">
                                    <span class="icon">
                                        <img src="@stamhoofd/assets/images/partners/icons/google.svg"></span>
                                    <span v-if="googleConfig.loginButtonText">{{ googleConfig.loginButtonText }}</span>
                                    <span v-else>{{ $t('fb69a88f-1fc4-4618-bab0-f348386df91d') }}</span>
                                </button>
                            </template>

                            <template v-if="ssoConfig">
                                <button class="button secundary full" type="button" tabindex="-1" @click="startSSO(LoginProviderType.SSO)">
                                    <span v-if="ssoConfig.loginButtonText">{{ ssoConfig.loginButtonText }}</span>
                                    <span v-else-if="!passwordConfig">{{ $t('e146434b-e70f-44de-85d3-6b80dbc21041') }}</span>
                                    <span v-else>{{ $t('72e793f4-d1e6-4e81-9c7d-4f0d1bee3d00') }}</span>
                                </button>
                            </template>
                        </div>

                        <hr><p class="style-description-small">
                            {{ $t('604ceb81-8c3e-4afc-afd2-d844eb4b5861') }}
                        </p>

                        <button class="button text selected" type="button" tabindex="-1" @click="openSignup">
                            <span>{{ $t('37a0bd14-62bc-45a4-b431-8dd5101de534') }}</span>
                            <span class="icon arrow-right-small"/>
                        </button>
                    </template>
                    <template v-else>
                        <p class="style-description-block">
                            {{ $t('2c09d899-fb28-436e-8889-8316a86ae6c2') }}
                        </p>

                        <div class="style-form-buttons">
                            <button v-if="ssoConfig" class="button primary full" type="button" tabindex="-1" @click="startSSO(LoginProviderType.SSO)">
                                <span v-if="ssoConfig.loginButtonText">{{ ssoConfig.loginButtonText }}</span>
                                <span v-else>{{ $t('e146434b-e70f-44de-85d3-6b80dbc21041') }}</span>
                            </button>
                            <button v-if="googleConfig" class="button secundary full" type="button" tabindex="-1" @click="startSSO(LoginProviderType.Google)">
                                <span class="icon">
                                    <img src="@stamhoofd/assets/images/partners/icons/google.svg"></span>
                                <span v-if="googleConfig.loginButtonText">{{ googleConfig.loginButtonText }}</span>
                                <span v-else>{{ $t('fb69a88f-1fc4-4618-bab0-f348386df91d') }}</span>
                            </button>
                        </div>
                    </template>
                </div>
            </div>

            <PlatformFooter/>
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
                customText: 'Bezig met laden...',
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
