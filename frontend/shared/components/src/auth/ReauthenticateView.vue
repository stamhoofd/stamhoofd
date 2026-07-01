<template>
    <form class="st-view reauthenticate-view" data-testid="reauthenticate-view" data-submit-last-field novalidate @submit.prevent="submit">
        <STNavigationBar :title="$t('Bevestig je identiteit')" />

        <main class="center">
            <h1>{{ $t('Bevestig je identiteit') }}</h1>
            <p>{{ $t('Voer je wachtwoord opnieuw in om deze gevoelige actie te bevestigen.') }}</p>

            <STErrorsDefault :error-box="errors.errorBox" />

            <EmailInput v-model="email" class="max" :disabled="true" name="username" autocomplete="username" enterkeyhint="next" :title="$t('E-mailadres')" :placeholder="$t(`%WT`)" />

            <STInputBox class="max" :title="$t(`%HK`)">
                <template #right>
                    <button class="button text" type="button" tabindex="-1" @click.prevent="gotoPasswordForgot">
                        <span>{{ $t('%Zj') }}</span>
                        <span class="icon help" />
                    </button>
                </template>
                <input id="password" v-model="password" v-autofocus="true" data-testid="reauth-password" enterkeyhint="go" class="input" name="current-password" autocomplete="current-password" type="password" :placeholder="$t(`%Zn`)" @input="(event: any) => password = event.target.value" @change="(event: any) => password = event.target.value">
            </STInputBox>
        </main>

        <STToolbar>
            <template #right>
                <LoadingButton :loading="loading">
                    <button class="button primary" type="submit" data-testid="reauth-submit">
                        <span>{{ $t('Bevestigen') }}</span>
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </form>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, NavigationController, useDismiss, useShow } from '@simonbackx/vue-app-navigation';
import { LoginHelper } from '@stamhoofd/networking/LoginHelper';
import { onUnmounted, ref } from 'vue';

import { AsyncComponent } from '#containers/AsyncComponent.ts';
import { ErrorBox } from '#errors/ErrorBox.ts';
import STErrorsDefault from '#errors/STErrorsDefault.vue';
import { useErrors } from '#errors/useErrors.ts';
import { useContext } from '#hooks/useContext.ts';
import { useUser } from '#hooks/useUser.ts';
import EmailInput from '#inputs/EmailInput.vue';
import STInputBox from '#inputs/STInputBox.vue';
import LoadingButton from '#navigation/LoadingButton.vue';
import STNavigationBar from '#navigation/STNavigationBar.vue';
import STToolbar from '#navigation/STToolbar.vue';
import { useForgotPassword } from './useForgotPassword.ts';

const props = defineProps<{
    // Called once the session holds a fresh token again.
    onAuthenticated: () => void | Promise<void>;
    onCancel: () => void;
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

async function complete() {
    if (didComplete) {
        return;
    }
    didComplete = true;
    // Dismiss the re-auth flow first, then let the caller retry its action.
    await dismiss({ force: true });
    await props.onAuthenticated();
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

async function submit() {
    if (loading.value) {
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
        } else if (result.mfaSetupToken) {
            await show({
                components: [
                    new ComponentWithProperties(NavigationController, {
                        root: AsyncComponent(() => import('./SetupMFAView.vue'), {
                            setupToken: result.mfaSetupToken,
                            onCompleted: complete,
                        }),
                    }),
                ],
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
