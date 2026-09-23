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

    <CategorizedBoxButtons v-else-if="$slots.right">
        <slot name="right" />
    </CategorizedBoxButtons>
</template>

<script setup lang="ts">
import CategorizedBoxButtons from '#layout/categorized-view/CategorizedBoxButtons.vue';

/** Level 0 renders no title: the parent (e.g. a CategorizedBox) renders it and receives the right slot */
withDefaults(
    defineProps<{
        level?: number;
        title: string;
    }>(), {
        level: 0,
    },
);
</script>
