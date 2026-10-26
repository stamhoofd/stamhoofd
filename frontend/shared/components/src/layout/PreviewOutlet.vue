<template>
    <div v-if="insidePreviewPanel" ref="element" class="preview-outlet" />
</template>

<script setup lang="ts">
import { useTemplateRef } from 'vue';
import { usePreviewOutlet } from './usePreviewPanel';

const element = useTemplateRef<HTMLElement>('element');
const insidePreviewPanel = usePreviewOutlet(element);
</script>

<style lang="scss">
.preview-outlet:has(> .preview-panel-preview) {
    padding-top: 30px;
}
</style>
