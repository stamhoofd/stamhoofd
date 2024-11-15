<template>
    <LoadingBox :appear="true" :show="show" :errorBox="errorBox" :view="true" />
</template>


<script lang="ts" setup>
import { ErrorBox } from "../errors/ErrorBox";
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
