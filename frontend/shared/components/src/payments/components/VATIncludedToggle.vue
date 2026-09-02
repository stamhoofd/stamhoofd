<template>
    <button v-if="invoicesEnabled || !model" class="button text small" type="button" @click="model = !model">
        <span v-if="model">{{ $t('%1Hs') }}</span>
        <span v-else>{{ $t('%1Ht') }}</span>
        <span class="icon arrow-swap small" />
    </button>
</template>

<script lang="ts" setup>
defineProps<{
    invoicesEnabled: boolean;
}>();

const model = defineModel<boolean>({ required: true });
</script>
