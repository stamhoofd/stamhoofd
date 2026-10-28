<template>
    <div class="webshop-device-preview">
        <header>
            <h1>{{ $t('Voorbeeld') }}</h1>
            <SegmentedControl v-model="device" class="devices" :items="['laptop', 'smartphone']" :icons="['laptop', 'smartphone']" :labels="[$t('Laptop'), $t('Smartphone')]" />
            <div class="right">
                <slot name="right" />
            </div>
        </header>
        <WebshopPreviewFrame :webshop="webshop" :class="device" :min-width="device === 'laptop' ? 1280 : undefined" />
    </div>
</template>

<script lang="ts" setup>
import SegmentedControl from '@stamhoofd/components/inputs/SegmentedControl.vue';
import type { Webshop } from '@stamhoofd/structures';
import WebshopPreviewFrame from './WebshopPreviewFrame.vue';

/**
 * The webshop as visitors see it on a laptop or smartphone, with a choice between both
 */
defineProps<{
    webshop: Webshop;
}>();

const device = defineModel<'laptop' | 'smartphone'>('device', { required: true });
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.webshop-device-preview {
    display: flex;
    flex-direction: column;
    align-items: center;

    > header {
        align-self: stretch;
        display: grid;
        // The devices stay centered while there is room, but never push the title onto two lines
        grid-template-columns: minmax(max-content, 1fr) auto minmax(max-content, 1fr);
        gap: 20px;
        align-items: center;
        height: 64px;

        > h1 {
            font-size: 20px;
            font-weight: $font-weight-bold;
            white-space: nowrap;
        }

        > .segmented-control.devices {
            // The control has no width of its own (contain: strict)
            width: 110px;
            margin: 0;
            justify-self: center;
        }

        > .right {
            display: flex;
            flex-direction: row;
            align-items: center;
            justify-content: flex-end;
            gap: 16px;
        }
    }

    > .webshop-preview-frame {
        flex-grow: 1;
        width: 100%;
        overflow: hidden;
        border-radius: $border-radius;
        background: $color-background;
        box-shadow: 0 0 0 1px $color-shadow, 0 4px 12px $color-input-shadow;

        // The screen of an iPhone
        &.smartphone {
            max-width: 390px;
            max-height: 844px;
            margin: var(--webshop-device-preview-margin-top, auto) 0 auto 0;
        }

        // A scaled down laptop keeps the shape of a laptop screen instead of filling a portrait screen
        &.laptop.scaled {
            flex-grow: 0;
            aspect-ratio: 16 / 10;
            margin: var(--webshop-device-preview-margin-top, auto) 0 auto 0;
        }
    }
}
</style>
