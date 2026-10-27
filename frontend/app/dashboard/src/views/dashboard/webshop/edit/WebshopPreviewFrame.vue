<template>
    <div ref="container" class="webshop-preview-frame">
        <iframe v-if="visible" ref="frame" :src="src" :title="$t('Voorbeeld')" />
    </div>
</template>

<script lang="ts" setup>
import { useElementSize } from '@stamhoofd/components/hooks/useElementSize.ts';
import { useRequiredOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import { createWebshopPreviewUpdateMessage, isWebshopPreviewReadyMessage, webshopPreviewParameter } from '@stamhoofd/components/webshops/webshopPreview.ts';
import type { Webshop } from '@stamhoofd/structures';
import { onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue';

/**
 * The real webshop, with the settings that are not saved yet (see webshopPreview.ts in the components)
 */
const props = defineProps<{
    webshop: Webshop;
}>();

const organization = useRequiredOrganization();

// Not reactive: the iframe would reload on every change. Changes are sent to it instead.
const src = 'https://' + props.webshop.getUrl(organization.value) + '?' + webshopPreviewParameter;
const origin = new URL(src).origin;

const frame = useTemplateRef<HTMLIFrameElement>('frame');
let ready = false;

// Only loaded once it is shown: a PreviewPanel first renders the preview hidden and then moves it, which would load
// the webshop twice (moving an iframe reloads it)
const { width } = useElementSize(useTemplateRef<HTMLElement>('container'));
const visible = ref(false);
watch(width, (value) => {
    if (value > 0) {
        visible.value = true;
    }
}, { immediate: true });

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

    > iframe {
        flex-grow: 1;
        width: 100%;
        border: 0;
    }
}
</style>
