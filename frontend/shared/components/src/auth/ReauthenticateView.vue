<template>
    <form class="st-view reauthenticate-view" data-testid="reauthenticate-view" novalidate @submit.prevent="submit">
        <STNavigationBar :title="$t('Bevestig je identiteit')" />

        <main class="center">
            <h1>{{ $t('Bevestig je identiteit') }}</h1>
            <p>{{ $t('Voer je wachtwoord opnieuw in om deze gevoelige actie te bevestigen.') }}</p>

            <STErrorsDefault :error-box="errors.errorBox" />

            <EmailInput v-model="email" :disabled="true" autocomplete="username" :title="$t('E-mailadres')" :placeholder="$t('E-mailadres')" />

            <STInputBox :title="$t('Wachtwoord')">
                <input v-model="password" class="input" type="password" autocomplete="current-password" data-testid="reauth-password" :placeholder="$t('Wachtwoord')">
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
import { ComponentWithProperties, NavigationController, useDismiss, usePresent } from '@simonbackx/vue-app-navigation';
import { LoginHelper } from '@stamhoofd/networking/LoginHelper';
import { ref } from 'vue';

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

const props = defineProps<{
    // Called once the session holds a fresh token again.
    onAuthenticated: () => void | Promise<void>;
}>();

const $context = useContext();
const $user = useUser();
const errors = useErrors();
const dismiss = useDismiss();
const present = usePresent();

const email = ref($user.value?.email ?? '');
const password = ref('');
const loading = ref(false);

async function complete() {
    // Dismiss the re-auth flow first, then let the caller retry its action.
    await dismiss({ force: true });
    await props.onAuthenticated();
}

async function submit() {
    if (loading.value) {
        return;
    }
    loading.value = true;
    errors.errorBox = null;

    try {
        const result = await LoginHelper.login($context.value, email.value, password.value);

        if (result.mfaChallenge) {
            await present({
                components: [
                    new ComponentWithProperties(NavigationController, {
                        root: AsyncComponent(() => import('./ChooseMFAMethodView.vue'), {
                            mfaChallenge: result.mfaChallenge,
                            onCompleted: complete,
                        }),
                    }),
                ],
                modalDisplayStyle: 'sheet',
            });
        }
        else if (result.mfaSetupToken) {
            await present({
                components: [
                    new ComponentWithProperties(NavigationController, {
                        root: AsyncComponent(() => import('./SetupMFAView.vue'), {
                            setupToken: result.mfaSetupToken,
                            onCompleted: complete,
                        }),
                    }),
                ],
                modalDisplayStyle: 'sheet',
            });
        }
        else {
            // Password alone produced a fresh token (user without 2FA enforcement).
            await complete();
        }
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    finally {
        loading.value = false;
    }
}
</script>
