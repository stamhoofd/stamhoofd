<template>
    <STInputBox :title="$t('Voorbeeld op smartphone')" class="max webshop-preview-card">
        <template #right>
            <button class="button text" type="button" data-testid="webshop-full-preview-button" @click="openFullPreview">
                <span class="icon eye" />
                <span>{{ $t('Groot voorbeeld') }}</span>
            </button>
        </template>

        <STCard>
            <WebshopPreviewFrame :webshop="webshop" />
        </STCard>
    </STInputBox>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
import STInputBox from '@stamhoofd/components/inputs/STInputBox.vue';
import STCard from '@stamhoofd/components/layout/STCard.vue';
import type { Webshop } from '@stamhoofd/structures';
import WebshopPreviewFrame from './WebshopPreviewFrame.vue';

/**
 * The webshop as visitors see it on their phone, next to the settings that change it
 */
const props = defineProps<{
    webshop: Webshop;
}>();

const present = usePresent();

function openFullPreview() {
    present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: AsyncComponent(() => import('./WebshopFullPreviewView.vue'), {
                    webshop: props.webshop,
                }),
            }),
        ],
        modalDisplayStyle: 'popup',
    }).catch(console.error);
}
</script>

<style lang="scss">
.webshop-preview-card .st-card {
    // The webshop runs from edge to edge of the card
    padding: 0;

    .st-card-body > .webshop-preview-frame {
        // The screen of a phone, within the column of the preview
        height: max(480px, calc(100vh - 220px));
        height: max(480px, calc(100dvh - 220px));
    }
}
</style>
