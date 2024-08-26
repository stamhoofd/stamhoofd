<template>
    <span v-if="icon" class="icon small" :class="icon" />
    <CountRing v-else-if="count" :count="count" :radius="8" :stroke="3" :border-width="2" />
    <ProgressRing v-else-if="progress" :progress="progress" :radius="8" :stroke="3" :border-width="2" />
</template>

<script setup lang="ts">
import CountRing from './CountRing.vue';
import ProgressRing from './ProgressRing.vue';

defineProps<{
    icon?: string;
    count?: number;
    progress?: number;
}>();
</script>
