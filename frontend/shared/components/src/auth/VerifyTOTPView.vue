<template>
    <form class="st-view verify-totp-view" data-testid="verify-totp-view" @submit.prevent="submit">
        <STNavigationBar :title="$t('%ZgY')" />

        <main class="center">
            <h1>{{ $t('%ZgY') }}</h1>
            <p>{{ $t('%ZhL') }}</p>

            <STErrorsDefault :error-box="errors.errorBox" />

            <div class="code-input-container">
                <CodeInput v-model="code" data-testid="mfa-totp-code" @complete="submit" />
            </div>
        </main>

        <STToolbar>
            <template #right>
                <LoadingButton :loading="loading">
                    <button class="button primary" type="submit" data-testid="mfa-totp-submit">
                        <span>{{ $t('%X9') }}</span>
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </form>
</template>

<script lang="ts" setup>
import { LoginHelper } from '@stamhoofd/networking/LoginHelper';
import { ref } from 'vue';

import { ErrorBox } from '#errors/ErrorBox.ts';
import STErrorsDefault from '#errors/STErrorsDefault.vue';
import { useErrors } from '#errors/useErrors.ts';
import { useContext } from '#hooks/useContext.ts';
import CodeInput from '#inputs/CodeInput.vue';
import LoadingButton from '#navigation/LoadingButton.vue';
import STNavigationBar from '#navigation/STNavigationBar.vue';
import type { NavigationActions } from '#types/NavigationActions.ts';
import { useNavigationActions } from '#types/NavigationActions.ts';
import STToolbar from '#navigation/STToolbar.vue';

const props = defineProps<{
    mfaToken: string;
    onCompleted: (navigation: NavigationActions) => void | Promise<void>;
}>();

const $context = useContext();
const errors = useErrors();
const navigationActions = useNavigationActions();
const code = ref('');
const loading = ref(false);

async function submit() {
    if (loading.value) {
        return;
    }
    loading.value = true;
    errors.errorBox = null;
    try {
        await LoginHelper.verifyMfaTotp($context.value, props.mfaToken, code.value);
        await props.onCompleted(navigationActions);
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
    } finally {
        loading.value = false;
    }
}
</script>

<style lang="scss">
.verify-totp-view {
    .code-input-container {
        padding: 12px 0;
    }
}
</style>
