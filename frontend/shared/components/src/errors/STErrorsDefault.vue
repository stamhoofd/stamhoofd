<template>
    <div ref="errorElement">
        <template v-for="(error, index) in errors" :key="index">
            <STErrorBox :error="error" />
        </template>
    </div>
</template>

<script setup lang="ts">
import { SimpleError } from '@simonbackx/simple-errors';
import { nextTick, ref, useTemplateRef, watch } from 'vue';

import { ErrorBox } from './ErrorBox';
import STErrorBox from './STErrorBox.vue';

const props = withDefaults(
    defineProps<{
        errorBox?: ErrorBox | null;
    }>(),
    {
        errorBox: null,
    });

const errors = ref<SimpleError[]>([]);
const errorsElement = useTemplateRef('errorElement');

watch(() => props.errorBox, (val: ErrorBox | null) => {
    ErrorBox.sendUpdateEventIfNeeded();

    if (!val) {
        errors.value = [];
        return;
    }
    // Wait for next tick, to prevent a useless rerender of errors that will get removed by other inputs
    nextTick(() => {
        const el = errorsElement.value as HTMLElement;
        if (!el) {
            return;
        }

        const remaining = props.errorBox?.remaining;
        if (!remaining) {
            return;
        }
        errors.value = remaining.errors;
        ErrorBox.scrollTo(errors.value, el);
    }).catch(console.error);
}, { immediate: true });
</script>
