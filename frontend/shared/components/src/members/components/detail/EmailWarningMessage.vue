<template>
    <span v-if="message" v-tooltip="message" class="icon small warning yellow" />
    <span v-else class="icon small" />
</template>

<script setup lang="ts">
defineProps<{
    message: string | null;
}>();
</script>
