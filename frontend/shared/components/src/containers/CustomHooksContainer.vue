
<template>
    <ComponentWithPropertiesInstance :key="root.key" :component="root" />
</template>

<script lang="ts" setup>
import { ComponentWithProperties, ComponentWithPropertiesInstance } from "@simonbackx/vue-app-navigation";

const props = defineProps<{
    root: ComponentWithProperties,
    hooks: () => void
}>();

props.hooks();

</script>
