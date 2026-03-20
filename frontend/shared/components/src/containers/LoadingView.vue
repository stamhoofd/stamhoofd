<template>
    <LoadingBox :appear="true" :show="show" :error-box="errorBox" :view="true" />
</template>


<script lang="ts" setup>
import type { ErrorBox } from "../errors/ErrorBox";
import LoadingBox from "./LoadingBox.vue";

withDefaults(
    defineProps<{
        show?: boolean,
        appear?: boolean,
        errorBox?: ErrorBox|null;
    }>(),
    {
        show: true,
        appear: true,
        errorBox: null
    }
);

</script>
