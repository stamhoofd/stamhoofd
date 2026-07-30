<template>
    <form class="st-view reauthenticate-view" data-testid="reauthenticate-view" data-submit-last-field novalidate @submit.prevent="submit">
        <STNavigationBar :title="$t('Bevestig je identiteit')" />

        <main class="center">
            <h1>{{ $t('Bevestig je identiteit') }}</h1>
            <p v-if="showPassword">
                {{ $t('Voer je wachtwoord opnieuw in om deze gevoelige actie te bevestigen.') }}
            </p>
            <p v-else>
                {{ $t('Meld je opnieuw aan om deze gevoelige actie te bevestigen.') }}
            </p>

            <STErrorsDefault :error-box="errors.errorBox" />

            <EmailInput v-model="email" class="max" :disabled="true" name="username" autocomplete="username" enterkeyhint="next" :title="$t('E-mailadres')" :placeholder="$t(`%WT`)" />

            <STInputBox v-if="showPassword" class="max" :title="$t(`%HK`)">
                <template #right>
                    <button class="button text" type="button" tabindex="-1" @click.prevent="gotoPasswordForgot">
                        <span>{{ $t('%Zj') }}</span>
                        <span class="icon help" />
                    </button>
                </template>
                <input id="password" v-model="password" v-autofocus="true" data-testid="reauth-password" enterkeyhint="go" class="input" name="current-password" autocomplete="current-password" type="password" :placeholder="$t(`%Zn`)" @input="(event: any) => password = event.target.value" @change="(event: any) => password = event.target.value">
            </STInputBox>

            <div class="style-form-buttons">
                <LoadingButton v-if="showPassword" :loading="loading" class="block">
                    <button id="submit" class="button primary full" type="submit" data-testid="reauth-submit">
                        <span class="lock icon" />
                        <span>{{ $t('Bevestigen') }}</span>
                    </button>
                </LoadingButton>
                <LoginMethodButton v-if="usesSSO" :config="ssoConfig!" :provider="LoginProviderType.SSO" :primary="!showPassword" :fallback-text="!showPassword ? $t('%Qg') : $t('%Zk')" data-testid="reauth-sso" @click="reauthenticateThroughSSO" />
            </div>
        </main>
    </form>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, NavigationController, useDismiss, useShow } from '@simonbackx/vue-app-navigation';
import { LoginHelper } from '@stamhoofd/networking/LoginHelper';
import { LoginMethod, LoginProviderType } from '@stamhoofd/structures';
import { computed, onUnmounted, ref } from 'vue';

import { AsyncComponent } from '#containers/AsyncComponent.ts';
import { ErrorBox } from '#errors/ErrorBox.ts';
import STErrorsDefault from '#errors/STErrorsDefault.vue';
import { useErrors } from '#errors/useErrors.ts';
import { useContext } from '#hooks/useContext.ts';
import { useLoginMethod, useLoginMethodEnabled } from '#hooks/useLoginMethods.ts';
import { useUser } from '#hooks/useUser.ts';
import LoginMethodButton from './LoginMethodButton.vue';
import EmailInput from '#inputs/EmailInput.vue';
import STInputBox from '#inputs/STInputBox.vue';
import LoadingButton from '#navigation/LoadingButton.vue';
import STNavigationBar from '#navigation/STNavigationBar.vue';
import STToolbar from '#navigation/STToolbar.vue';
import { useForgotPassword } from './useForgotPassword.ts';
import { SimpleError } from '@simonbackx/simple-errors';
import { useAppNavigate } from '#hooks/useAppNavigate.ts';
import { AppRoute } from '@stamhoofd/structures/AppRoute.js';

const props = defineProps<{
    // Called once the session holds a fresh token again.
    onAuthenticated: () => void | Promise<void>;
    onCancel: (error?: Error) => void;
}>();

const $context = useContext();
const $user = useUser();
const errors = useErrors();
const dismiss = useDismiss();
const show = useShow();

const email = ref($user.value?.email ?? '');
const password = ref('');
const loading = ref(false);
let didComplete = false;
const { gotoPasswordForgot } = useForgotPassword({ email });

const passwordEnabled = useLoginMethodEnabled(email, LoginMethod.Password);
const ssoEnabled = useLoginMethodEnabled(email, LoginMethod.SSO);
const ssoConfig = useLoginMethod(LoginMethod.SSO);

const usesPassword = computed(() => passwordEnabled.value && ($user.value?.hasPassword ?? false));

// An SSO-only account has no password to confirm with, so signing in at the provider again
// is the only way for it to reach the actions that need a fresh authentication.
const usesSSO = computed(() => ssoEnabled.value && !!ssoConfig.value && ($user.value?.meta?.loginProviderIds.has(LoginProviderType.SSO) ?? false));

// The password stays the fallback: only an account that can actually use the provider gets
// the shorter screen without it.
const showPassword = computed(() => usesPassword.value || !usesSSO.value);

async function complete() {
    if (didComplete) {
        return;
    }
    didComplete = true;
    // Dismiss the re-auth flow first, then let the caller retry its action.
    await dismiss({ force: true });
    await props.onAuthenticated();
}
const appNavigate = useAppNavigate();

function completeWithError(error: Error) {
    if (didComplete) {
        return;
    }
    didComplete = true;
    props.onCancel(error);
}
onUnmounted(() => {
    // We require a small delay because it is possible we first dismiss and only after that call complete
    setTimeout(() => {
        if (didComplete) {
            return;
        }
        didComplete = true;
        props.onCancel();
    }, 50);
});

/**
 * Confirm the identity at the identity provider. This leaves the app, so the pending action
 * is not resumed automatically: the session is fresh again when the user returns and they
 * can start it over.
 */
async function reauthenticateThroughSSO() {
    if (loading.value) {
        return;
    }
    loading.value = true;
    errors.errorBox = null;

    try {
        // This redirects, so the loading state stays until the page is left.
        await $context.value.startSSO({
            providerType: LoginProviderType.SSO,
            // Ask the provider to verify the user again instead of silently reusing its own session.
            prompt: 'login',
            reauthenticate: true,
        });
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
        loading.value = false;
    }
}

async function submit() {
    if (loading.value) {
        return;
    }

    if (!showPassword.value) {
        await reauthenticateThroughSSO();
        return;
    }

    loading.value = true;
    errors.errorBox = null;

    try {
        const result = await LoginHelper.login($context.value, email.value, password.value);

        if (result.mfaChallenge) {
            await show({
                components: [
                    new ComponentWithProperties(NavigationController, {
                        root: AsyncComponent(() => import('./ChooseMFAMethodView.vue'), {
                            isRefreshing: true,
                            mfaChallenge: result.mfaChallenge,
                            onCompleted: complete,
                        }),
                    }),
                ],
            });
        } else if (result.mfaSetup) {
            const mfaSetup = result.mfaSetup;
            await show({
                components: [
                    new ComponentWithProperties(NavigationController, {
                        root: AsyncComponent(() => import('./SetupMFAView.vue'), {
                            setupToken: mfaSetup.setupToken,
                            canUsePasskeys: mfaSetup.canUsePasskeys,
                            onCompleted: complete,
                        }),
                    }),
                ],
            });
        } else if (result.verificationToken) {
            await appNavigate(AppRoute.VerifyEmail, {
                properties: {
                    token: result.verificationToken,
                    email: email.value,
                    organization: $context.value.organization,
                },
                adjustHistory: false,
            });
        } else {
            // Password alone produced a fresh token (user without 2FA enforcement).
            await complete();
        }
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
    } finally {
        loading.value = false;
    }
}
</script>
