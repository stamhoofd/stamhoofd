<template>
    <Teleport v-if="target" :to="target">
        <slot />
    </Teleport>
</template>

<script lang="ts" setup>
import { inject } from 'vue';
import { categorizedBoxButtonsTarget } from './categorizedBoxButtonsTarget';

// The box registers its header after mounting, so the slot renders one tick later. Renders nothing outside a CategorizedBox.
const target = inject(categorizedBoxButtonsTarget, null);
</script>
