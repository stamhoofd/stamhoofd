<template>
    <ComponentWithPropertiesInstance :key="root.key" :component="root" />
</template>

<script lang="ts" setup>
import type { ComponentWithProperties } from '@stamhoofd/browser-navigation';
import { ComponentWithPropertiesInstance } from '@stamhoofd/browser-navigation';

const props = defineProps<{
    root: ComponentWithProperties;
    hooks: () => void;
}>();

props.hooks();

</script>
