<template>
    <div class="loading-button" :class="{loading}">
        <div><slot /></div>
        <div>
            <Spinner v-if="loading || delayLoading" />
        </div>
    </div>
</template>

<script lang="ts" setup>
import { ref, watch } from 'vue';

import Spinner from '../Spinner.vue';

const props = withDefaults(defineProps<{
    loading?: boolean | null;
}>(), {
    loading: false,
});

// Remove the spinner animation from the dom to save some resources of the browser
const delayLoading = ref(false);

watch(() => props.loading, (val, old) => {
    if (!val && old) {
        delayLoading.value = true;
        setTimeout(() => {
            delayLoading.value = false;
        }, 500);
    } else {
        if (val) {
            delayLoading.value = true;
        }
    }
});
</script>

<style lang="scss">

.loading-button {
    position: relative;
    display: block;
    max-width: fit-content;
    //max-width: max-content;

    &:first-child:last-child {
        // Fixes whitespace taking up space
        display: block;
    }

    &.block {
        display: block;
    }

    &.max {
        display: block;
        width: 100%;
        max-width: none;
    }

    &.bottom {
        margin-top: auto;
        padding-top: 15px;
    }

    > div:first-child {
        transition: transform 0.3s;
        display: flex;
        flex-direction: column;
        align-items: stretch;
    }

    > div:last-child {
        position: absolute;
        opacity: 0;
        top: 50%;
        left: 50%;
        width: 24px;
        height: 24px;
        transition: opacity 0.3s;
        contain: strict;
        transform: translate(-50%, -50%);

        pointer-events: none;
        display: flex;
        align-items: center;
        justify-content: flex-end;
    }

    &.loading {
        > div:first-child {
            opacity: 0.2;
        }
        > div:last-child {
            opacity: 1;
        }
    }
}
</style>
