<template>
    <form class="st-view setup-totp-view" data-testid="setup-totp-view" data-submit-last-field novalidate @submit.prevent="submit">
        <STNavigationBar :title="$t('%ZhV')" />

        <main class="center">
            <h1>{{ $t('%ZhV') }}</h1>
            <p v-if="showQRCode">
                {{ $t('%Zga') }}
            </p>
            <p v-else>
                {{ $t('Open je authenticator-app via de knop hieronder, of voeg de sleutel handmatig toe. Voer daarna de code in.') }}
            </p>

            <div class="totp-setup" :class="{ 'no-qr': !showQRCode }">
                <img v-if="showQRCode && qrCodeUrl" :src="qrCodeUrl" class="qr-code" :alt="$t('%Zf9')">
                <p class="totp-secret">
                    <span v-copyable="totpSetup.secret" class="secret style-copyable">{{ totpSetup.secret }}</span>
                </p>
            </div>

            <p class="style-button-bar">
                <a :href="totpSetup.otpauthUri" class="button text" data-testid="open-authenticator-app">
                    <span class="icon external" />
                    <span>{{ $t('Open in authenticator-app') }}</span>
                </a>
            </p>

            <STErrorsDefault :error-box="errors.errorBox" />

            <STInputBox :title="$t('%ZgZ')" class="max" error-fields="name" :error-box="errors.errorBox">
                <input v-model="name" data-op-ignore data-lpignore="true" data-bwignore="true" data-form-type="other" class="input" type="text" autocomplete="off" enterkeyhint="next" :placeholder="$isIOS || $isMac ? $t('%Zhm') : $t('%Zgr')">
            </STInputBox>
            <STInputBox :title="$t('%ZgP')" class="max" error-fields="code" :error-box="errors.errorBox">
                <CodeInput v-model="code" data-testid="mfa-setup-totp-code" :code-length="6" :space-length="6" @complete="submit" />
            </STInputBox>
        </main>

        <STToolbar>
            <template #right>
                <LoadingButton :loading="loading">
                    <button class="button primary" type="submit" data-testid="mfa-setup-totp-submit">
                        <span>{{ $t('%X9') }}</span>
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </form>
</template>

<script lang="ts" setup>
import { useShow } from '@simonbackx/vue-app-navigation';
import { MFAManager } from '@stamhoofd/networking/MFAManager';
import type { TOTPSetupResponse } from '@stamhoofd/structures';
import { onMounted, ref } from 'vue';

import { AsyncComponent } from '#containers/AsyncComponent.ts';
import { ErrorBox } from '#errors/ErrorBox.ts';
import STErrorsDefault from '#errors/STErrorsDefault.vue';
import { useErrors } from '#errors/useErrors.ts';
import { useContext } from '#hooks/useContext.ts';
import { useIsAndroid } from '#hooks/useIsAndroid.ts';
import { useIsIOS } from '#hooks/useIsIOS.ts';
import CodeInput from '#inputs/CodeInput.vue';
import STInputBox from '#inputs/STInputBox.vue';
import LoadingButton from '#navigation/LoadingButton.vue';
import STNavigationBar from '#navigation/STNavigationBar.vue';
import type { NavigationActions } from '#types/NavigationActions.ts';
import { useNavigationActions } from '#types/NavigationActions.ts';
import STToolbar from '#navigation/STToolbar.vue';

import { SimpleError } from '@simonbackx/simple-errors';
import { useFreshAction } from './useFreshAction';

const props = defineProps<{
    totpSetup: TOTPSetupResponse;
    // Present during forced enrollment; null for a logged-in (fresh Bearer) enrollment.
    setupToken?: string | null;
    onCompleted: (navigation: NavigationActions) => void | Promise<void>;
}>();

const $context = useContext();
const errors = useErrors();
const navigationActions = useNavigationActions();
const show = useShow();
const runFresh = useFreshAction();

const code = ref('');
const name = ref('');
const loading = ref(false);
const qrCodeUrl = ref<string | null>(null);

// A phone or tablet cannot scan its own screen: there the otpauth link is the only one-tap way in.
const showQRCode = !useIsIOS() && !useIsAndroid();

onMounted(() => {
    if (!showQRCode) {
        return;
    }
    generateQRCode().catch(console.error);
});

async function generateQRCode() {
    const QRCode = (await import(/* webpackChunkName: "QRCode" */ 'qrcode')).default;
    qrCodeUrl.value = await QRCode.toDataURL(props.totpSetup.otpauthUri, {
        margin: 0,
        width: 300,
        color: {
            light: '#ffffff',
            dark: '#000000',
        },
    });
}

async function submit() {
    if (loading.value) {
        return;
    }
    loading.value = true;
    errors.errorBox = null;
    try {
        if (code.value.length !== 6) {
            throw new SimpleError({
                code: 'invalid_field',
                field: 'code',
                message: $t('%Zhn'),
            });
        }
        const result = await runFresh(() => MFAManager.confirmTotp($context.value, props.totpSetup.totpId, code.value, name.value, props.setupToken ?? undefined));

        // Show the recovery codes BEFORE applying the session token: applying it completes
        // the session, which swaps the root of the app and destroys this flow.
        if (result.recoveryCodes && result.recoveryCodes.codes.length > 0) {
            await show({
                components: [
                    AsyncComponent(() => import('./ShowRecoveryCodesView.vue'), {
                        codes: result.recoveryCodes.codes,
                        // Hand on the actions of the view that actually finishes the flow,
                        // so whoever started it dismisses the right thing.
                        onCompleted: async (navigation: NavigationActions) => {
                            await MFAManager.applyEnrollmentResult($context.value, result);
                            await props.onCompleted(navigation);
                        },
                    }),
                ],
            });
            return;
        }

        await MFAManager.applyEnrollmentResult($context.value, result);
        await props.onCompleted(navigationActions);
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
    } finally {
        loading.value = false;
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.setup-totp-view {
    .totp-setup {
        border: 1px solid $color-border;
        padding: 30px;
        text-align: center;
        border-radius: 8px;
        position: relative;
        // The secret hangs half outside the box, so it needs room of its own below it
        margin-bottom: 30px;

        .qr-code {
            width: 100%;
            aspect-ratio: 1/1;
            display: block;
        }

        .totp-secret .secret {
            position: absolute;
            font-family: monospace;
            user-select: all;
            background: $color-current-background;
            padding: 5px 10px;
            left: 50%;
            bottom: 0;
            transform: translate(-50%, 50%);
        }

        // Without the QR code the box only holds the secret, so it no longer floats on the border
        &.no-qr {
            padding: 15px;
            margin-bottom: 15px;

            .totp-secret .secret {
                position: static;
                transform: none;
                display: inline-block;
            }
        }
    }

    .code-input-container {
        padding: 12px 0;
    }
}
</style>
