<template>
    <SaveView class="auto" data-submit-last-field save-icon="lock" :title="$t(`%uu`)" @save="submit">
        <h1 v-if="$context.user?.hasPassword">
            {{ $t('%uu') }}
        </h1>
        <h1 v-else>
            {{ $t('%jl') }}
        </h1>

        <STErrorsDefault :error-box="errorBox" />

        <input id="username" style="display: none;" type="text" name="username" autocomplete="username" :value="email"><STInputBox :title="$t(`%WV`)">
            <input id="new-password" v-model="password" class="input" enterkeyhint="next" autocomplete="new-password" type="password" :placeholder="$t(`%ZV`)">
        </STInputBox>

        <STInputBox :title="$t(`%WW`)">
            <input id="confirm-password" v-model="passwordRepeat" enterkeyhint="go" class="input" autocomplete="new-password" type="password" :placeholder="$t(`%WX`)">
        </STInputBox>

        <PasswordStrength v-model="password" />
    </SaveView>
</template>

<script lang="ts" setup>
import { SimpleError } from '@simonbackx/simple-errors';
import { useDismiss } from '@simonbackx/vue-app-navigation';
import { ErrorBox } from '#errors/ErrorBox.ts';
import PasswordStrength from '#inputs/PasswordStrength.vue';
import SaveView from '#navigation/SaveView.vue';
import STErrorsDefault from '#errors/STErrorsDefault.vue';
import STInputBox from '#inputs/STInputBox.vue';
import { Toast } from '#overlays/Toast.ts';
import { LoginHelper } from '@stamhoofd/networking/LoginHelper';
import { computed, ref } from 'vue';
import { useContext } from '../hooks/useContext';

const context = useContext();
const dismiss = useDismiss();
const loading = ref(false);
const password = ref('');
const passwordRepeat = ref('');
const errorBox = ref<ErrorBox | null>(null);
const email = computed(() => context.value.user?.email ?? '');

async function submit() {
    if (loading.value) {
        return;
    }

    // Request the key constants

    if (password.value !== passwordRepeat.value) {
        errorBox.value = new ErrorBox(new SimpleError({
            code: '',
            message: $t(`%12T`),
        }));
        return;
    }

    if (password.value.length < 8) {
        errorBox.value = new ErrorBox(new SimpleError({
            code: '',
            message: $t(`%v2`),
        }));
        return;
    }
    loading.value = true;

    try {
        await LoginHelper.changePassword(context.value, password.value);
        await dismiss({ force: true });
        new Toast($t(`%12U`), 'success').show();
    } catch (e) {
        loading.value = false;
        errorBox.value = new ErrorBox(e);
    }
}
</script>
