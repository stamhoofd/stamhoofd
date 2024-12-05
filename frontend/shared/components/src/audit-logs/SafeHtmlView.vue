<template>
    <div class="st-view">
        <STNavigationBar :title="title" />
        <main ref="main">
            <h1>Inhoud</h1>
            <iframe ref="iframeRef" sandbox="" />
        </main>
    </div>
</template>

<script lang="ts" setup>
import { onMounted, useTemplateRef, watch } from 'vue';
import { useResizeObserver } from '../inputs/hooks/useResizeObserver';

const props = defineProps<{
    html: string;
    title: string;
}>();
const iframe = useTemplateRef('iframeRef');
const mainElement = useTemplateRef('main');

// Make sure the iframe width and height matches the width and height of main
function updateSize() {
    if (!iframe.value || !mainElement.value) {
        return;
    }
    const elementComputedStyle = window.getComputedStyle(mainElement.value, null);
    const paddingLeft = parseFloat(elementComputedStyle.getPropertyValue('padding-left'));
    const paddingRight = parseFloat(elementComputedStyle.getPropertyValue('padding-right'));
    const paddingTop = parseFloat(elementComputedStyle.getPropertyValue('padding-top'));
    const paddingBottom = parseFloat(elementComputedStyle.getPropertyValue('padding-bottom'));
    iframe.value.width = `${mainElement.value.clientWidth - paddingLeft - paddingRight}px`;
    iframe.value.height = `${mainElement.value.clientHeight - paddingTop - paddingBottom}px`;
}

watch(() => props.html, (newHTML) => {
    if (!iframe.value) {
        return;
    }
    replaceIframeContent(iframe.value, newHTML);
});

watch(() => iframe.value, () => {
    if (!iframe.value) {
        return;
    }
    updateSize();
    replaceIframeContent(iframe.value, props.html);
});

onMounted(() => {
    updateSize();
});

useResizeObserver(mainElement, () => {
    updateSize();
});

function replaceIframeContent(iframeElement: HTMLIFrameElement, newHTML: string) {
    iframeElement.src = 'data:text/html;base64,' + base64Encode(newHTML);
}

function base64Encode(str: string) {
    // This fixes UTF-8 encoding issues
    const bytes = new TextEncoder().encode(str);
    const binString = String.fromCodePoint(...bytes);
    return btoa(binString);
}

</script>
