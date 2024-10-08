<template>
    <form class="st-view login-view" data-submit-last-field @submit.prevent="submit">
        <STNavigationBar :large="true" title="Inloggen" class="transparent" />

        <main class="center small flex">
            <div class="st-view-vertical-center">
                <div class="container">
                    <h1>{{ $t('d54c9b23-2d3c-49cd-b1fc-7e821d36fd41') }}</h1>

                    <STErrorsDefault :error-box="errors.errorBox" />

                    <EmailInput id="username" ref="emailInput" v-model="email" :autofocus="!initialEmail" enterkeyhint="next" class="max" name="username" title="E-mailadres" :validator="errors.validator" placeholder="Vul jouw e-mailadres hier in" autocomplete="username" :disabled="lock !== null" />
                    <p v-if="lock" class="style-description-small">
                        {{ lock }}
                    </p>

                    <STInputBox title="Wachtwoord" class="max">
                        <template #right>
                            <button class="button text" type="button" tabindex="-1" @click.prevent="gotoPasswordForgot">
                                <span>Vergeten</span>
                                <span class="icon help" />
                            </button>
                        </template>
                        <input id="password" v-model="password" :autofocus="!!initialEmail" enterkeyhint="go" class="input" name="current-password" placeholder="Vul jouw wachtwoord hier in" autocomplete="current-password" type="password" @input="(event) => password = event.target.value" @change="(event) => password = event.target.value">
                    </STInputBox>
                    <VersionFooter v-if="showVersionFooter" />

                    <LoadingButton v-else :loading="loading" class="block">
                        <button id="submit" class="button primary full" type="submit">
                            <span class="lock icon" />
                            <span>Inloggen</span>
                        </button>
                    </LoadingButton>

                    <hr>
                    <p class="style-description-small">
                        Of maak een nieuw account aan als je nog geen account hebt. Gebruik bij voorkeur een e-mailadres waarnaar we je al e-mails sturen.
                    </p>

                    <button class="button text selected" type="button" tabindex="-1" @click="openSignup">
                        <span>Account aanmaken</span>
                        <span class="icon arrow-right-small" />
                    </button>
                </div>
            </div>

            <PlatformFooter />
        </main>
    </form>
</template>

<script lang="ts" setup>
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, defineRoutes, useDismiss, useNavigate, usePresent } from '@simonbackx/vue-app-navigation';
import { AppManager, LoginHelper } from '@stamhoofd/networking';
import { computed, onMounted, ref } from 'vue';

import VersionFooter from '../context/VersionFooter.vue';
import { ErrorBox } from '../errors/ErrorBox';
import { useErrors } from '../errors/useErrors';
import { useContext } from '../hooks';
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

async function submit() {
    if (loading.value) {
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
