<template>
    <form class="st-view forgot-password-view" novalidate @submit.prevent="submit">
        <STNavigationBar :title="$t(`%uz`)" />
        <main class="center small">
            <h1>{{ $t('%uz') }}</h1>
            <p>{{ $t('%ZW') }}</p>

            <STErrorsDefault :error-box="errorBox" />
            <EmailInput v-model="email" autocomplete="username" :validator="validator" class="max" :title="$t(`%1FK`)" :placeholder="$t(`%WT`)" />

            <LoadingButton :loading="loading" class="block">
                <button class="button primary full" type="submit">
                    {{ $t('%ZX') }}
                </button>
            </LoadingButton>
        </main>
    </form>
</template>

<script lang="ts" setup>
import { useDismiss } from '@simonbackx/vue-app-navigation';
import EmailInput from '#inputs/EmailInput.vue';
import { ErrorBox } from '#errors/ErrorBox.ts';
import LoadingButton from '#navigation/LoadingButton.vue';
import STErrorsDefault from '#errors/STErrorsDefault.vue';
import STNavigationBar from '#navigation/STNavigationBar.vue';
import { Toast } from '#overlays/Toast.ts';
import { Validator } from '#errors/Validator.ts';
import { ForgotPasswordRequest } from '@stamhoofd/structures';
import { ref } from 'vue';
import { useContext } from '../hooks/useContext';

const props = withDefaults(defineProps<{
    initialEmail?: string;
}>(), {
    initialEmail: '',
});

const context = useContext();
const dismiss = useDismiss();
const loading = ref(false);
const email = ref(props.initialEmail);
const validator = new Validator();
const errorBox = ref<ErrorBox | null>(null);

async function submit() {
    if (loading.value) {
        return;
    }
    loading.value = true;
    errorBox.value = null;

    if (!(await validator.validate())) {
        loading.value = false;
        return;
    }

    try {
        await context.value.server.request({
            method: 'POST',
            path: '/forgot-password',
            body: ForgotPasswordRequest.create({ email: email.value }),
            shouldRetry: false,
        });

        await dismiss({ force: true });
        new Toast($t(`%v0`), 'success').show();
    } catch (e) {
        errorBox.value = new ErrorBox(e);
    }

    loading.value = false;
}
</script>
