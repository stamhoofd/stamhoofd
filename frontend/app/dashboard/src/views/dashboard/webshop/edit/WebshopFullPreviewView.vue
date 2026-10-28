<template>
    <div class="st-view webshop-full-preview-view">
        <WebshopDevicePreview v-model:device="device" :webshop="webshop">
            <template #right>
                <button class="button icon close" type="button" data-testid="close-button" :aria-label="$t('Sluiten')" @click="dismiss()" />
            </template>
        </WebshopDevicePreview>
    </div>
</template>

<script lang="ts" setup>
import { useDismiss } from '@browser/navigation';
import { useIsMobile } from '@stamhoofd/components/hooks/useIsMobile.ts';
import type { Webshop } from '@stamhoofd/structures';
import { ref } from 'vue';
import WebshopDevicePreview from './WebshopDevicePreview.vue';

/**
 * The webshop as visitors see it on a laptop or smartphone, with the changes that are not saved yet
 */
const props = defineProps<{
    webshop: Webshop;
    device?: 'laptop' | 'smartphone';
}>();

const device = ref(props.device ?? (useIsMobile() ? 'smartphone' : 'laptop'));
const dismiss = useDismiss();
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.webshop-full-preview-view {
    --color-current-background: #{$color-background-shade};
    --color-current-background-shade: #{$color-background-shade-darker};

    > .webshop-device-preview {
        flex-grow: 1;
        min-height: 0;
        padding: var(--st-safe-area-top, 0px) max(10px, var(--st-safe-area-right, 0px)) calc(10px + var(--st-safe-area-bottom, 0px)) max(10px, var(--st-safe-area-left, 0px));

        > header {
            padding: 0 10px;
        }
    }
}
</style>
