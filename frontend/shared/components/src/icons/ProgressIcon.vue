<template>
    <span v-if="icon" class="icon small" :class="icon" />
    <span v-else-if="count" class="style-bubble primary">
        {{ count }}
    </span>
    <ProgressRing v-else-if="progress" :progress="progress" :radius="8" :stroke="3" :border-width="2" />
</template>

<script setup lang="ts">
import ProgressRing from './ProgressRing.vue';

defineProps<{
    icon?: string;
    count?: number;
    progress?: number;
}>();
</script>
