<template>
    <div class="st-view setup-mfa-view" data-testid="setup-mfa-view">
        <STNavigationBar :title="$t('Tweestapsverificatie instellen')" />

        <main class="center">
            <h1>{{ $t('Tweestapsverificatie instellen') }}</h1>
            <p>{{ $t('Je account vereist tweestapsverificatie. Stel een tweede factor in om verder te gaan.') }}</p>

            <STErrorsDefault :error-box="errors.errorBox" />

            <STList>
                <STListItem :selectable="true" data-testid="mfa-setup-passkey" @click.prevent="startPasskeySetup">
                    <template #left>
                        <span class="icon key" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('Passkey toevoegen') }}
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

                <STListItem :selectable="true" data-testid="mfa-setup-totp" @click.prevent="startTotpSetup">
                    <template #left>
                        <span class="icon clock" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('Authenticator-app instellen') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t('Bijvoorbeeld Google Authenticator, 1Password of Bitwarden.') }}
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
import { MFAManager } from '@stamhoofd/networking/MFAManager';
import type { MFAEnrollmentResult } from '@stamhoofd/structures';
import { ref } from 'vue';

import { AsyncComponent } from '#containers/AsyncComponent.ts';
import { ErrorBox } from '#errors/ErrorBox.ts';
import STErrorsDefault from '#errors/STErrorsDefault.vue';
import { useErrors } from '#errors/useErrors.ts';
import { useContext } from '#hooks/useContext.ts';
import STList from '#layout/STList.vue';
import STListItem from '#layout/STListItem.vue';
import LoadingButton from '#navigation/LoadingButton.vue';
import STNavigationBar from '#navigation/STNavigationBar.vue';

const props = defineProps<{
    setupToken: string;
    // Called after the first factor is enrolled and the session holds a fresh token.
    onCompleted: () => void | Promise<void>;
}>();

const $context = useContext();
const errors = useErrors();
const show = useShow();
const dismiss = useDismiss();

const loading = ref(false);

async function startTotpSetup() {
    if (loading.value) {
        return;
    }
    loading.value = true;
    errors.errorBox = null;
    try {
        const totpSetup = await MFAManager.setupTotp($context.value, props.setupToken);
        await show({
            components: [
                AsyncComponent(() => import('./SetupTOTPView.vue'), {
                    totpSetup,
                    setupToken: props.setupToken,
                    onCompleted: props.onCompleted,
                }),
            ],
        });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    finally {
        loading.value = false;
    }
}

async function startPasskeySetup() {
    if (loading.value) {
        return;
    }
    loading.value = true;
    errors.errorBox = null;
    try {
        const result: MFAEnrollmentResult = await MFAManager.registerPasskey($context.value, $t('Passkey'), props.setupToken);
        await MFAManager.applyEnrollmentResult($context.value, result);

        if (result.recoveryCodes && result.recoveryCodes.codes.length > 0) {
            await show({
                components: [
                    AsyncComponent(() => import('./ShowRecoveryCodesView.vue'), {
                        codes: result.recoveryCodes.codes,
                        onCompleted: props.onCompleted,
                    }),
                ],
            });
            return;
        }

        await dismiss({ force: true });
        await props.onCompleted();
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    finally {
        loading.value = false;
    }
}
</script>
