<template>
    <form class="st-view verify-recovery-code-view" data-testid="verify-recovery-code-view" novalidate @submit.prevent="submit">
        <STNavigationBar :title="$t('Herstelcode')" />

        <main class="center">
            <h1>{{ $t('Herstelcode') }}</h1>
            <p>{{ $t('Voer een van je herstelcodes in.') }}</p>

            <STErrorsDefault :error-box="errors.errorBox" />

            <STInputBox :title="$t('Herstelcode')">
                <input v-model="recoveryCode" class="input" type="text" autocomplete="off" data-testid="mfa-recovery-code" :placeholder="$t('Herstelcode')">
            </STInputBox>
        </main>

        <STToolbar>
            <template #right>
                <LoadingButton :loading="loading">
                    <button class="button primary" type="submit" data-testid="mfa-recovery-submit">
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
import STInputBox from '#inputs/STInputBox.vue';
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

const recoveryCode = ref('');
const loading = ref(false);

async function submit() {
    if (loading.value) {
        return;
    }
    loading.value = true;
    errors.errorBox = null;
    try {
        await LoginHelper.verifyMfaRecoveryCode($context.value, props.mfaToken, recoveryCode.value);
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
