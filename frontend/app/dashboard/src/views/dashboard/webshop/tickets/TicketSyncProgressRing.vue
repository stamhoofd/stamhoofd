<template>
    <span class="spinner-container" role="progressbar" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="progressPercentage ?? undefined">
        <ProgressRing :radius="10" :stroke="2" :progress="(progressPercentage ?? 0) / 100" :loading="progressPercentage === null" />
    </span>
</template>

<script lang="ts" setup>
import ProgressRing from '@stamhoofd/components/icons/ProgressRing.vue';

defineProps<{
    /**
     * Shows a spinner while null
     */
    progressPercentage: number | null;
}>();
</script>
