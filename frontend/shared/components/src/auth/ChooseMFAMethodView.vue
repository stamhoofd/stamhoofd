<template>
    <div class="st-view choose-mfa-method-view" data-testid="choose-mfa-method-view">
        <STNavigationBar :title="title" />

        <main class="center">
            <h1>{{ title }}</h1>
            <p>{{ $t('Bevestig je aanmelding met je ingestelde tweedestapsverificatie-methode.') }}</p>

            <STErrorsDefault :error-box="errors.errorBox" />

            <p v-if="passkeyBlockedReason === 'domain'" class="warning-box" data-testid="passkey-domain-warning">
                {{ hasOtherMethods
                    ? $t('Je passkey werkt enkel op {domain}. Kies hieronder een andere methode, of meld je aan via {domain}.', { domain: passkeyDomain })
                    : $t('Je hebt enkel een passkey ingesteld, en die werkt enkel op {domain}. Meld je daar aan om verder te gaan.', { domain: passkeyDomain }) }}
            </p>
            <p v-else-if="passkeyBlockedReason === 'unsupported'" class="warning-box">
                {{ $t('Deze browser ondersteunt geen passkeys.') }}
            </p>

            <STList>
                <STListItem v-if="showPasskey" :selectable="true" data-testid="mfa-choose-passkey" @click.prevent="verifyPasskey">
                    <template #left>
                        <IconContainer icon="key" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('Passkey of beveiligingssleutel') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t('Gebruik je toestel, vingerafdruk of gezichtsherkenning.') }}
                    </p>
                    <template #right>
                        <LoadingButton :loading="loading">
                            <span class="icon arrow-right-small" />
                        </LoadingButton>
                    </template>
                </STListItem>

                <STListItem v-if="hasMethod(MFAMethodType.TOTP)" :selectable="true" data-testid="mfa-choose-totp" @click.prevent="chooseTotp">
                    <template #left>
                        <IconContainer icon="smartphone" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('Authenticator-app') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t('Voer de code uit je authenticator-app in.') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small" />
                    </template>
                </STListItem>

                <STListItem v-if="hasMethod(MFAMethodType.RecoveryCode)" :selectable="true" data-testid="mfa-choose-recovery" @click.prevent="chooseRecovery">
                    <template #left>
                        <IconContainer icon="recovery-keys" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('Herstelcode gebruiken') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t('Gebruik een van de herstelcodes die je had afgedrukt of veilig bewaard.') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small" />
                    </template>
                </STListItem>
            </STList>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { useShow } from '@simonbackx/vue-app-navigation';
import { LoginHelper } from '@stamhoofd/networking/LoginHelper';
import type { MFAChallengeResponse } from '@stamhoofd/structures';
import { MFAMethodType } from '@stamhoofd/structures';
import { computed, ref } from 'vue';

import { AsyncComponent } from '#containers/AsyncComponent.ts';
import { ErrorBox } from '#errors/ErrorBox.ts';
import STErrorsDefault from '#errors/STErrorsDefault.vue';
import { useErrors } from '#errors/useErrors.ts';
import { useContext } from '#hooks/useContext.ts';
import IconContainer from '#icons/IconContainer.vue';
import STList from '#layout/STList.vue';
import STListItem from '#layout/STListItem.vue';
import LoadingButton from '#navigation/LoadingButton.vue';
import STNavigationBar from '#navigation/STNavigationBar.vue';
import type { NavigationActions } from '#types/NavigationActions.ts';
import { useNavigationActions } from '#types/NavigationActions.ts';
import { getPasskeyDomain, getPasskeyUnavailableReason } from './passkeyAvailability.ts';

const props = withDefaults(defineProps<{
    // Set isRefreshing true to indicate that we ask for the CURRENT authenticator, not a new one
    isRefreshing?: boolean;
    mfaChallenge: MFAChallengeResponse;
    // Called after the session holds a fresh token (login completed).
    onCompleted: (navigation: NavigationActions) => void | Promise<void>;
}>(), {
    isRefreshing: false,
});

const $context = useContext();
const errors = useErrors();
const navigationActions = useNavigationActions();
const show = useShow();
const title = computed(() => {
    return props.isRefreshing ? $t('Bevestig met je huidige tweestapsverificatie') : $t('Tweestapsverificatie');
});

const loading = ref(false);

function hasMethod(method: MFAMethodType): boolean {
    return props.mfaChallenge.methods.includes(method);
}

/**
 * A passkey is bound to the domain it was created on, so it cannot be used from an
 * organization's own domain or from the app. Say so instead of offering an option that
 * ends in a browser error, and point at what the user can do instead.
 */
const passkeyBlockedReason = computed(() => hasMethod(MFAMethodType.Passkey) ? getPasskeyUnavailableReason() : null);
const showPasskey = computed(() => hasMethod(MFAMethodType.Passkey) && passkeyBlockedReason.value === null);
const hasOtherMethods = computed(() => hasMethod(MFAMethodType.TOTP) || hasMethod(MFAMethodType.RecoveryCode));
const passkeyDomain = getPasskeyDomain();

async function chooseTotp() {
    await show({
        components: [
            AsyncComponent(() => import('./VerifyTOTPView.vue'), {
                mfaToken: props.mfaChallenge.token,
                onCompleted: props.onCompleted,
            }),
        ],
    });
}

async function chooseRecovery() {
    await show({
        components: [
            AsyncComponent(() => import('./VerifyRecoveryCodeView.vue'), {
                mfaToken: props.mfaChallenge.token,
                onCompleted: props.onCompleted,
            }),
        ],
    });
}

async function verifyPasskey() {
    if (loading.value) {
        return;
    }
    loading.value = true;
    errors.errorBox = null;
    try {
        if ((await LoginHelper.verifyMfaPasskey($context.value, props.mfaChallenge.token, props.mfaChallenge.webauthnAuthenticationOptions) === false)) {
            return;
        }
        await props.onCompleted(navigationActions);
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
    } finally {
        loading.value = false;
    }
}
</script>
