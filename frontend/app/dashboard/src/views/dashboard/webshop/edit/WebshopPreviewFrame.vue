<template>
    <div ref="container" class="webshop-preview-frame" :class="{ scaled: !!scaledStyle }">
        <iframe v-if="visible" ref="frame" :src="src" :title="$t('Voorbeeld')" :style="scaledStyle" />
    </div>
</template>

<script lang="ts" setup>
import { useElementSize } from '@stamhoofd/components/hooks/useElementSize.ts';
import { useRequiredOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import { createWebshopPreviewUpdateMessage, getWebshopPreviewUrl, isWebshopPreviewReadyMessage } from '@stamhoofd/components/webshops/webshopPreview.ts';
import type { Webshop } from '@stamhoofd/structures';
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue';

/**
 * The real webshop, with the settings that are not saved yet (see webshopPreview.ts in the components)
 */
const props = defineProps<{
    webshop: Webshop;
    /**
     * The webshop is laid out at least this wide and scaled down to fit, e.g. to show the layout of a laptop on a
     * smartphone
     */
    minWidth?: number;
}>();

const organization = useRequiredOrganization();

// The iframe loads again when its url changes, so changes are sent to it instead. Only a different default language
// opens it again: the webshop only loads its language when it opens. The address stays the same, e.g. while typing a
// new domain.
const webshopUrl = props.webshop.getUrl(organization.value);
const src = computed(() => getWebshopPreviewUrl(webshopUrl, props.webshop));
const origin = new URL(src.value).origin;

const frame = useTemplateRef<HTMLIFrameElement>('frame');
let ready = false;
watch(src, () => {
    // Until the webshop is loaded again
    ready = false;
});

// Only loaded once it is shown: a PreviewPanel first renders the preview hidden and then moves it, which would load
// the webshop twice (moving an iframe reloads it)
const { width, height } = useElementSize(useTemplateRef<HTMLElement>('container'));
const visible = ref(false);
watch(width, (value) => {
    if (value > 0) {
        visible.value = true;
    }
}, { immediate: true });

const scaledStyle = computed(() => {
    if (!props.minWidth || width.value <= 0 || width.value >= props.minWidth) {
        return undefined;
    }
    const scale = width.value / props.minWidth;
    return {
        // Out of the flow: its unscaled size would otherwise grow the container, which changes the scale again
        position: 'absolute' as const,
        top: 0,
        left: 0,
        width: props.minWidth + 'px',
        height: (height.value / scale) + 'px',
        transform: `scale(${scale})`,
        transformOrigin: '0 0',
    };
});

function send() {
    if (!ready) {
        return;
    }
    frame.value?.contentWindow?.postMessage(createWebshopPreviewUpdateMessage(props.webshop), origin);
}

function onMessage(event: MessageEvent) {
    if (event.origin !== origin || event.source !== frame.value?.contentWindow || !isWebshopPreviewReadyMessage(event.data)) {
        return;
    }
    // Also after the webshop reloaded itself
    ready = true;
    send();
}

watch(() => props.webshop, send);

onMounted(() => window.addEventListener('message', onMessage));
onBeforeUnmount(() => window.removeEventListener('message', onMessage));
</script>

<style lang="scss">
.webshop-preview-frame {
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;

    > iframe {
        flex-grow: 1;
        width: 100%;
        border: 0;
    }
}
</style>
