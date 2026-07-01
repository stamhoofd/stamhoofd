<template>
    <form class="st-view verify-totp-view" data-testid="verify-totp-view" @submit.prevent="submit">
        <STNavigationBar :title="$t('Authenticator-app')" />

        <main class="center">
            <h1>{{ $t('Authenticator-app') }}</h1>
            <p>{{ $t('Voer de zescijferige code uit je authenticator-app in.') }}</p>

            <STErrorsDefault :error-box="errors.errorBox" />

            <div class="code-input-container">
                <CodeInput v-model="code" data-testid="mfa-totp-code" @complete="submit" />
            </div>
        </main>

        <STToolbar>
            <template #right>
                <LoadingButton :loading="loading">
                    <button class="button primary" type="submit" data-testid="mfa-totp-submit">
                        <span>{{ $t('Bevestigen') }}</span>
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </form>
</template>

<script lang="ts" setup>
import { useDismiss } from '@simonbackx/vue-app-navigation';
import { LoginHelper } from '@stamhoofd/networking/LoginHelper';
import { ref } from 'vue';

import { ErrorBox } from '#errors/ErrorBox.ts';
import STErrorsDefault from '#errors/STErrorsDefault.vue';
import { useErrors } from '#errors/useErrors.ts';
import { useContext } from '#hooks/useContext.ts';
import CodeInput from '#inputs/CodeInput.vue';
import LoadingButton from '#navigation/LoadingButton.vue';
import STNavigationBar from '#navigation/STNavigationBar.vue';
import STToolbar from '#navigation/STToolbar.vue';

const props = defineProps<{
    mfaToken: string;
    onCompleted: () => void | Promise<void>;
}>();

const $context = useContext();
const errors = useErrors();
const dismiss = useDismiss();

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
.verify-totp-view {
    .code-input-container {
        padding: 12px 0;
    }
}
</style>
