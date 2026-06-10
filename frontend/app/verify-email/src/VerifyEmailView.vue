<template>
    <form class="verify-email-view st-view small" data-testid="verify-email-view" :data-token="token" @submit.prevent="submit">
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

        <img src="@stamhoofd/assets/images/illustrations/email.svg" class="email-illustration">

        <main class="center">
            <h1>{{ $t('%ZS') }}</h1>
            <p v-if="email">
                {{ $t('%ZU', { email }) }}
            </p>

            <div><CodeInput v-model="codeInput" @complete="submit" /></div>
            <div><STErrorsDefault :error-box="errorBox" /></div>
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
import { CodeInput, ErrorBox, STErrorsDefault, STNavigationBar, STToolbar, useAppNavigate, useContext } from '@stamhoofd/components';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import LoadingButton from '@stamhoofd/components/navigation/LoadingButton.vue';
import { LoginHelper } from '@stamhoofd/networking';
import { AppRoute } from '@stamhoofd/structures';

const props = defineProps<{
    token: string;
    email: string;
    code?: string;
}>();

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
        Toast.success($t('Jouw e-mailadres is nu geverifieerd!')).setTestId('toast-email-verification-succeeded').show();
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

    .email-illustration {
        width: 100px;
        height: 100px;
        display: block;
        margin: 0 auto;
        margin-bottom: 20px;
    }
}
</style>
