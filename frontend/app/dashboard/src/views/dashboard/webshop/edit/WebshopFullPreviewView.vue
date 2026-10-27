<template>
    <div class="st-view webshop-full-preview-view">
        <STNavigationBar :title="$t('Voorbeeld')" />
        <main>
            <WebshopPreviewFrame :webshop="webshop" />
        </main>
    </div>
</template>

<script lang="ts" setup>
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
import type { Webshop } from '@stamhoofd/structures';
import WebshopPreviewFrame from './WebshopPreviewFrame.vue';

/**
 * The webshop as visitors see it on a large screen, with the changes that are not saved yet
 */
defineProps<{
    webshop: Webshop;
}>();
</script>

<style lang="scss">
.webshop-full-preview-view {
    --st-popup-width: 1200px;

    > main {
        display: flex;
        flex-direction: column;
        flex-grow: 1;
        // Below the navigation bar, which floats over main
        padding: var(--st-navigation-bar-correction, 50px) 0 0 0;

        > .webshop-preview-frame {
            flex-grow: 1;
        }
    }
}
</style>
