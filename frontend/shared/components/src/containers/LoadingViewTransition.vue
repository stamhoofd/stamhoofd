<template>
    <LoadingBoxTransition :errorBox="errorBox" :view="true" :loading="loading">
        <slot />
    </LoadingBoxTransition>
</template>


<script lang="ts" setup>
import { ErrorBox } from "../errors/ErrorBox";
import LoadingBoxTransition from "./LoadingBoxTransition.vue";

withDefaults(
    defineProps<{
        errorBox?: ErrorBox|null;
        loading?: boolean;
    }>(),
    {
        errorBox: null,
        loading: false
    }
);

</script>
