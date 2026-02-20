<template>
    <div ref="errorElement" :class="{'input-errors': errors.length > 0}">
        <slot />
        <div>
            <STErrorBox v-for="(error, index) of errors" :key="index" :error="error" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { ref, useTemplateRef, watch } from 'vue';

import { ErrorBox } from './ErrorBox';
import STErrorBox from './STErrorBox.vue';

const props = withDefaults(
    defineProps<{
        errorFields?: string;
        errorBox?: ErrorBox | ErrorBox[] | null;
    }>(),
    {
        errorFields: '',
        errorBox: null,
    });

const errors = ref<SimpleError[]>([]);
const errorsElement = useTemplateRef('errorElement');

watch(() => props.errorBox, (val: ErrorBox | ErrorBox[] | null) => {
    if (!val) {
        errors.value = [];
        return;
    }
    const arr = Array.isArray(val) ? val : [val];
    if (arr.length === 0) {
        errors.value = [];
        return;
    }
    let newArray: SimpleError[] = [];
    for (const errorBox of arr) {
        if (props.errorFields === '') {
            continue;
        }
        let errorList: SimpleErrors;

        if (props.errorFields === '*') {
            errorList = errorBox.remaining;
        }
        else {
            errorList = errorBox.forFields(props.errorFields.split(','));
        }

        newArray.push(...errorList.errors);

        // If no input element currently focused
        const el = errorsElement.value as HTMLElement;
        if (!el) {
            continue;
        }
        if (document.activeElement && el?.contains(document.activeElement)) {
            continue;
        }
        ErrorBox.scrollTo(newArray, el);
    }
    errors.value = newArray;
}, { immediate: true });
</script>
