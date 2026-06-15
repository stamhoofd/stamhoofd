<template>
    <LoadingBoxTransition :error-box="errorBox" :view="view" :loading="loading">
        <slot />
    </LoadingBoxTransition>
</template>

<script lang="ts" setup>
import type { ErrorBox } from '../errors/ErrorBox';
import LoadingBoxTransition from './LoadingBoxTransition.vue';

withDefaults(
    defineProps<{
        errorBox?: ErrorBox | null;
        loading?: boolean;
        view?: boolean;
    }>(),
    {
        errorBox: null,
        loading: false,
        view: true,
    },
);

</script>
