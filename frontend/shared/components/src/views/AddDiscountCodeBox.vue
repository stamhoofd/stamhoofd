<template>
    <div class="container">
        <p v-if="!isEnteringDiscountCode">
            <button type="button" class="button text" @click="addDiscountCode">
                <span class="icon label" />
                <span>{{ $t('%jy') }}</span>
            </button>
        </p>
        <hr v-if="isEnteringDiscountCode"><form v-if="isEnteringDiscountCode" data-submit-last-field @submit.prevent="addEnteredCode">
            <STInputBox error-fields="code" :error-box="errorBox" class="max" :title="$t(`%1MX`)">
                <div class="split-inputs">
                    <input v-model="code" autofocus enterkeyhint="go" class="input" type="text" autocomplete="off" :placeholder="$t(`%k0`)" @blur="cleanCode"><LoadingButton :loading="loading">
                        <button class="button primary" type="submit">
                            {{ $t('%jz') }}
                        </button>
                    </LoadingButton>
                </div>
            </STInputBox>
        </form>
    </div>
</template>

<script lang="ts" setup>
import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { ErrorBox } from '#errors/ErrorBox.ts';
import STInputBox from '#inputs/STInputBox.vue';
import LoadingButton from '#navigation/LoadingButton.vue';
import { Formatter } from '@stamhoofd/utility';
import { ref } from 'vue';

const props = defineProps<{
    applyCode: (code: string) => Promise<boolean>;
}>();

const isEnteringDiscountCode = ref(false);
const code = ref('');
const errorBox = ref<ErrorBox | null>(null);
const loading = ref(false);

function addDiscountCode() {
    isEnteringDiscountCode.value = true;
}

function cleanCode() {
    code.value = Formatter.slug(code.value.trim()).toUpperCase();
}

async function addEnteredCode() {
    if (loading.value) {
        return;
    }
    loading.value = true;
    try {
        cleanCode();
        if (await props.applyCode(code.value)) {
            isEnteringDiscountCode.value = false;
            code.value = '';
        } else {
            errorBox.value = new ErrorBox(new SimpleError({
                code: 'invalid_code',
                field: 'code',
                message: $t(`%12O`),
            }));
        }
    } catch (e) {
        console.error(e);
        if (isSimpleError(e) || isSimpleErrors(e)) {
            e.addNamespace('code');
        }
        errorBox.value = new ErrorBox(e);
    }
    loading.value = false;
}
</script>
