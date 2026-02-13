<template>
    <span v-if="warningMessage" v-tooltip="warningMessage" class="icon small warning yellow" />
    <span v-else class="icon small" />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useEmailWarningMessage } from '../../../hooks';

const props = defineProps<{
    email: string | null | undefined;
}>();

const email = computed(() => props.email);
const warningMessage = useEmailWarningMessage(email);
</script>
