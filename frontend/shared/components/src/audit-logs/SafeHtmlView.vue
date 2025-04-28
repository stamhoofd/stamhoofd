<template>
    <div class="st-view">
        <STNavigationBar :title="title" />
        <main ref="main">
            <h1>{{ $t('ffefe12f-b125-412a-8dab-0468eeb0f048') }}</h1>
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
const iframe = useTemplateRef<HTMLIFrameElement>('iframeRef');
const mainElement = useTemplateRef<HTMLElement>('main');

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

function cleanHtml(html: string) {
    if (html.startsWith('<!DOCTYPE html>')) {
        return html;
    }

    // Add body and html tag, with 0 padding
    // This is needed because the iframe will not render the html correctly otherwise
    return `
        <!DOCTYPE html>
        <html style="padding: 0; margin: 0;">
            <head>
                <style>
                    body {
                        padding: 0;
                        margin: 0;
                    }
                </style>
            </head>
            <body>${html}</body>
        </html>
    `;
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
    iframeElement.src = 'data:text/html;base64,' + base64Encode(cleanHtml(newHTML));
}

function base64Encode(str: string) {
    // This fixes UTF-8 encoding issues
    const bytes = new TextEncoder().encode(str);
    const binString = String.fromCodePoint(...bytes);
    return btoa(binString);
}

</script>
