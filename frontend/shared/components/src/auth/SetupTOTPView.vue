<template>
    <form class="st-view setup-totp-view" data-testid="setup-totp-view" novalidate @submit.prevent="submit">
        <STNavigationBar :title="$t('Authenticator-app instellen')" />

        <main class="center">
            <h1>{{ $t('Authenticator-app instellen') }}</h1>
            <p>{{ $t('Scan de QR-code met je authenticator-app en voer daarna de code in.') }}</p>

            <STErrorsDefault :error-box="errors.errorBox" />

            <div class="totp-setup">
                <img v-if="totpSetup.qrCodeDataUrl" :src="totpSetup.qrCodeDataUrl" class="qr-code" :alt="$t('QR-code')">
                <p class="style-description-small totp-secret">
                    {{ $t('Of voer deze sleutel handmatig in:') }} <span class="secret">{{ totpSetup.secret }}</span>
                </p>
            </div>

            <STInputBox :title="$t('Naam')">
                <input v-model="name" class="input" type="text" autocomplete="off" :placeholder="$t('Bv. iPhone van Jan')">
            </STInputBox>

            <div class="code-input-container">
                <CodeInput v-model="code" data-testid="mfa-setup-totp-code" @complete="submit" />
            </div>
        </main>

        <STToolbar>
            <template #right>
                <LoadingButton :loading="loading">
                    <button class="button primary" type="submit" data-testid="mfa-setup-totp-submit">
                        <span>{{ $t('Bevestigen') }}</span>
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </form>
</template>

<script lang="ts" setup>
import { useDismiss, useShow } from '@simonbackx/vue-app-navigation';
import { MFAManager } from '@stamhoofd/networking/MFAManager';
import type { TOTPSetupResponse } from '@stamhoofd/structures';
import { ref } from 'vue';

import { AsyncComponent } from '#containers/AsyncComponent.ts';
import { ErrorBox } from '#errors/ErrorBox.ts';
import STErrorsDefault from '#errors/STErrorsDefault.vue';
import { useErrors } from '#errors/useErrors.ts';
import { useContext } from '#hooks/useContext.ts';
import CodeInput from '#inputs/CodeInput.vue';
import STInputBox from '#inputs/STInputBox.vue';
import LoadingButton from '#navigation/LoadingButton.vue';
import STNavigationBar from '#navigation/STNavigationBar.vue';
import STToolbar from '#navigation/STToolbar.vue';

import { useFreshAction } from './useFreshAction';

const props = defineProps<{
    totpSetup: TOTPSetupResponse;
    // Present during forced enrollment; null for a logged-in (fresh Bearer) enrollment.
    setupToken?: string | null;
    onCompleted: () => void | Promise<void>;
}>();

const $context = useContext();
const errors = useErrors();
const show = useShow();
const dismiss = useDismiss();
const runFresh = useFreshAction();

const code = ref('');
const name = ref('');
const loading = ref(false);

async function submit() {
    if (loading.value) {
        return;
    }
    loading.value = true;
    errors.errorBox = null;
    try {
        const result = await runFresh(() => MFAManager.confirmTotp($context.value, props.totpSetup.totpId, code.value, name.value, props.setupToken ?? undefined));
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

<style lang="scss">
.setup-totp-view {
    .totp-setup {
        .qr-code {
            width: 200px;
            height: 200px;
            display: block;
            margin: 0 auto 12px;
        }

        .totp-secret .secret {
            font-family: monospace;
            user-select: all;
        }
    }

    .code-input-container {
        padding: 12px 0;
    }
}
</style>
