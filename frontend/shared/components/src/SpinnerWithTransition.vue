<template>
    <TransitionFade>
        <Spinner v-if="isLoading"/>
        <slot v-else/>
    </TransitionFade>
</template>

<script lang="ts" setup>
import Spinner from './Spinner.vue';
import TransitionFade from './transitions/TransitionFade.vue';

defineProps<{isLoading: boolean}>();
</script>
