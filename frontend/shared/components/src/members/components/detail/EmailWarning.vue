<template>
    <span v-if="warning" v-tooltip="warning" class="icon small warning yellow" />
    <span v-else class="icon small" />
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';
import { useEmailInformationManager } from '../../../hooks';

defineOptions({
    inheritAttrs: false,
});

const props = defineProps<{
    email: string | null | undefined;
}>();

const emailInformationManager = useEmailInformationManager();

const email = computed(() => props.email);
const warning = emailInformationManager.subscribeForEmailWarning(email);

watch(warning, () => {
    if (email.value === 'desmedtbart@gmail.com') {
        console.warn(`Warning for ${props.email}: ${warning.value}`);
    }
}, { immediate: true });
</script>
