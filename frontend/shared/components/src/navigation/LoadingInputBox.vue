<template>
    <div>
        <div v-if="loading || delayLoading" class="input-wrapper">
            <input
                class="input with-spinner"
                type="text"
                autocomplete="off"
                :placeholder="$t('%1CU')"
                :disabled="true"
            >
            <Spinner class="spinner-inside-input" />
        </div>
        <div v-else>
            <slot />
        </div>
    </div>
</template>

<script lang="ts" setup>
import { ref, watch } from 'vue';

import Spinner from '../Spinner.vue';

const props = withDefaults(defineProps<{
    loading?: boolean;
}>(), {
    loading: false,
});

const delayLoading = ref(false);

watch(() => props.loading, (val, oldVal) => {
    if (!val && oldVal) {
        delayLoading.value = true;
        setTimeout(() => {
            delayLoading.value = false;
        }, 500);
    }
    else if (val) {
        delayLoading.value = true;
    }
});
</script>

<style lang="scss">
.input-wrapper {
    position: relative;
    display: inline-block;
    width: 100%;
}

.input.with-spinner {
    padding-right: 2.5em; /* leave space for spinner */
}

.spinner-inside-input {
    position: absolute;
    right: 0.75em;
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
}
</style>
