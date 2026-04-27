<template>
    <div class="st-view">
        <QuickActionsBox :quick-actions="quickActions" />
    </div>
</template>

<script setup lang="ts">
import type { QuickActions } from './classes';
import QuickActionsBox from './QuickActionsBox.vue';

const props = defineProps<{
    quickActions: QuickActions;
}>();

</script>
