<template>
    <form class="verify-email-view st-view" data-testid="verify-email-view" :data-token="token" @submit.prevent="submit">
        <STNavigationBar>
            <template #right>
                <LoadingButton :loading="retrying">
                    <button class="button text" type="button" @click="retry">
                        <span class="icon retry" />
                        <span>{{ $t('%Y9') }}</span>
                    </button>
                </LoadingButton>
            </template>
        </STNavigationBar>

        <main class="center">
            <img src="@stamhoofd/assets/images/illustrations/email.svg" class="email-illustration">

            <h1 class="style-navigation-title">
                {{ $t('%ZS') }}
            </h1>
            <div><STErrorsDefault :error-box="errorBox" /></div>

            <div class="code-input-container">
                <CodeInput v-model="codeInput" @complete="submit" />
            </div>

            <p v-if="email" class="style-description-small">
                {{ $t('%ZU', { email }) }}
            </p>
        </main>

        <STToolbar>
            <template #right>
                <LoadingButton :loading="loading">
                    <button class="button primary full" type="button">
                        <span>{{ $t('%16p') }}</span>
                        <span class="icon arrow-right" />
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </form>
</template>

<script lang="ts" setup>
import { onMounted, onUnmounted, ref } from 'vue';
import CodeInput from '@stamhoofd/components/inputs/CodeInput.vue';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
import STToolbar from '@stamhoofd/components/navigation/STToolbar.vue';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox';
import { useAppNavigate } from '@stamhoofd/components/hooks/useAppNavigate';
import { useContext } from '@stamhoofd/components/hooks/useContext';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import LoadingButton from '@stamhoofd/components/navigation/LoadingButton.vue';
import { LoginHelper } from '@stamhoofd/networking/LoginHelper';
import { AppRoute } from '@stamhoofd/structures';
import STInputBox from '@stamhoofd/components/inputs/STInputBox.vue';

const props = withDefaults(
    defineProps<{
        token: string;
        email?: string | null;
        code?: string | null;
    }>(), {
        email: null,
        code: null,
    },
);

const context = useContext();
const appNavigate = useAppNavigate();

const codeInput = ref('');
const loading = ref(false);
const retrying = ref(false);
const errorBox = ref<ErrorBox | null>(null);

async function navigateAway() {
    const org = context.value.organization;
    if (org) {
        await appNavigate(AppRoute.OrgScopedAuto, { properties: { organization: org } });
    } else {
        await appNavigate(AppRoute.UnscopedAuto);
    }
}

// Polling for automatic verification (e.g. user clicks link in email in another tab)
let pollTimer: ReturnType<typeof setTimeout> | null = null;
let polling = false;
let pollCount = 0;

async function doPoll() {
    if (polling) return;
    polling = true;
    try {
        const stop = await LoginHelper.pollEmail(context.value, props.token);
        if (stop) {
            await navigateAway();
            return;
        }
    } catch (e) {
        console.error(e);
    }
    pollCount++;
    polling = false;
    if (pollCount > 150) return; // stop after ~12 minutes
    pollTimer = setTimeout(() => void doPoll(), Math.max(pollCount * 1000, 5000));
}

onMounted(async () => {
    if (props.code) {
        codeInput.value = props.code;
        await submit();
    }
    pollTimer = setTimeout(() => void doPoll(), 10_000);
});

onUnmounted(() => {
    if (pollTimer) {
        clearTimeout(pollTimer);
        pollTimer = null;
    }
    polling = false;
});

async function retry() {
    if (retrying.value) return;
    if (!await CenteredMessage.confirm($t('%uk'), $t('%ul'), $t('%um'))) return;
    retrying.value = true;
    try {
        const stop = await LoginHelper.retryEmail(context.value, props.token);
        if (stop) {
            await navigateAway();
            return;
        }
        new Toast($t('%un'), $t('%16')).show();
    } catch (e) {
        errorBox.value = new ErrorBox(e as Error);
    }
    retrying.value = false;
}

async function submit() {
    if (loading.value) return;
    loading.value = true;
    errorBox.value = null;
    try {
        await LoginHelper.verifyEmail(context.value, codeInput.value, props.token);
        Toast.success($t('%1ZH')).setTestId('toast-email-verification-succeeded').show();
        await navigateAway();
    } catch (e) {
        errorBox.value = new ErrorBox(e as Error);
    }
    loading.value = false;
}
</script>

<style lang="scss">
.verify-email-view {
    text-align: center;

    .code-input-container {
        padding-bottom: 12px;
    }

    .email-illustration {
        width: 60px;
        height: 60px;
        display: block;
        margin: 0 auto;
        margin-bottom: 20px;
    }
}
</style>
