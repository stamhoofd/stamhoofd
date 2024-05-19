<template>
    <component :is="level === 1 ? 'h1' : 'h2'" v-if="level > 0">
        {{ title }}
    </component>
</template>

<script setup lang="ts">
withDefaults(
    defineProps<{
        level?: number,
        title: string
    }>(), {
        level: 0
    }
);
</script>
