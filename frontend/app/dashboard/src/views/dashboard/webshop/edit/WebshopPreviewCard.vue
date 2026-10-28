<template>
    <WebshopDevicePreview v-model:device="device" class="webshop-preview-card" :webshop="webshop">
        <template #right>
            <button v-tooltip="$t('Volledig scherm')" class="button icon fullscreen" type="button" data-testid="webshop-full-preview-button" @click="openPreview(device)" />
        </template>
    </WebshopDevicePreview>
</template>

<script lang="ts" setup>
import type { Webshop } from '@stamhoofd/structures';
import { toRef } from 'vue';
import { useWebshopPreview } from './useWebshopPreview';
import WebshopDevicePreview from './WebshopDevicePreview.vue';

/**
 * The webshop as visitors see it, next to the settings that change it (in the preview slot of a PreviewPanel)
 */
const props = defineProps<{
    webshop: Webshop;
}>();

const device = defineModel<'laptop' | 'smartphone'>('device', { default: 'smartphone' });
const { openPreview } = useWebshopPreview(toRef(props, 'webshop'));
</script>

<style lang="scss">
.preview-panel:has(.webshop-preview-card) {
    // Room for the smartphone and the controls of the preview, once the settings keep enough room themselves
    @media (min-width: 1400px) {
        --preview-panel-width: 520px;
    }
}

.webshop-preview-card {
    // Directly below the controls instead of centered in the column
    --webshop-device-preview-margin-top: 0px;

    // Fills the column of the preview panel without scrolling it: the height and padding of that column (see PreviewPanel.vue)
    height: max(480px, calc(var(--vh, 1vh) * 100 - 2 * var(--st-vertical-padding, 20px) - var(--st-safe-area-top, 0px) - var(--st-safe-area-bottom, 0px)));
}
</style>
