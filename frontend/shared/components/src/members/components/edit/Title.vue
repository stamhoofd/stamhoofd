<template>
    <component :is="level === 1 ? 'h1' : 'h2'" v-if="$slots.right && level > 0" class="style-with-button">
        <div>{{ title }}</div>
        <div>
            <slot name="right" />
        </div>
    </component>

    <component :is="level === 1 ? 'h1' : 'h2'" v-else-if="level > 0">
        {{ title }}
    </component>
</template>

<script setup lang="ts">
withDefaults(
    defineProps<{
        level?: number;
        title: string;
    }>(), {
        level: 0,
    },
);
</script>
