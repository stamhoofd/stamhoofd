<template>
    <div class="st-view choose-mfa-method-view" data-testid="choose-mfa-method-view">
        <STNavigationBar :title="title" />

        <main class="center">
            <h1>{{ title }}</h1>
            <p>{{ $t('Bevestig je aanmelding met je ingestelde tweedestapsverificatie-methode.') }}</p>

            <STErrorsDefault :error-box="errors.errorBox" />

            <STList>
                <STListItem v-if="hasMethod(MFAMethodType.Passkey)" :selectable="true" data-testid="mfa-choose-passkey" @click.prevent="verifyPasskey">
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
import { useDismiss, useShow } from '@simonbackx/vue-app-navigation';
import { LoginHelper } from '@stamhoofd/networking/LoginHelper';
import type { MFAChallengeResponse } from '@stamhoofd/structures';
import { MFAMethodType } from '@stamhoofd/structures';
import { computed, ref } from 'vue';

import { AsyncComponent } from '#containers/AsyncComponent.ts';
import { ErrorBox } from '#errors/ErrorBox.ts';
import STErrorsDefault from '#errors/STErrorsDefault.vue';
import { useErrors } from '#errors/useErrors.ts';
import { useContext } from '#hooks/useContext.ts';
import STList from '#layout/STList.vue';
import STListItem from '#layout/STListItem.vue';
import LoadingButton from '#navigation/LoadingButton.vue';
import STNavigationBar from '#navigation/STNavigationBar.vue';
import IconContainer from '#icons/IconContainer.vue';

const props = withDefaults(defineProps<{
    // Set isRefreshing true to indicate that we ask for the CURRENT authenticator, not a new one
    isRefreshing?: boolean;
    mfaChallenge: MFAChallengeResponse;
    // Called after the session holds a fresh token (login completed).
    onCompleted: () => void | Promise<void>;
}>(), {
    isRefreshing: false,
});

const $context = useContext();
const errors = useErrors();
const show = useShow();
const dismiss = useDismiss();
const title = computed(() => {
    return props.isRefreshing ? $t('Bevestig met je huidige tweestapsverificatie') : $t('Tweestapsverificatie');
});

const loading = ref(false);

function hasMethod(method: MFAMethodType): boolean {
    return props.mfaChallenge.methods.includes(method);
}

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
        await dismiss({ force: true });
        await props.onCompleted();
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
    } finally {
        loading.value = false;
    }
}
</script>
