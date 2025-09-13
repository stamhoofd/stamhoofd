<template>
    <iframe ref="iframeRef" :sandbox="sandbox" />
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue';
import { useResizeObserver } from '../inputs/hooks/useResizeObserver';

const props = withDefaults(
    defineProps<{
        html: string;
        allowClicks?: boolean;
        customCss?: string;
    }>(), {
        allowClicks: false,
        customCss: '',
    },
);
const iframe = useTemplateRef<HTMLIFrameElement>('iframeRef');
const mainElement = computed(() => iframe.value?.parentElement ?? null);
const iframeDocument = ref<Document | null>(null);
const iframeDocumentHtml = computed(() => iframeDocument.value?.documentElement ?? null);
const iframeDocumentBody = computed(() => iframeDocument.value?.body ?? null);

const sandbox = computed(() => {
    let s = 'allow-same-origin';
    if (props.allowClicks) {
        s += ' allow-popups-to-escape-sandbox allow-popups';
    }
    return s;
});

// Make sure the iframe width and height matches the width and height of main
function updateSize() {
    if (!iframe.value || !mainElement.value) {
        console.warn('SafeHtmlBox: iframe or main element not found');
        console.log(iframeDocument.value, mainElement.value, iframe.value);
        return;
    }
    // For some reason, it is very important to not use computed properties for contentDocument, otherwise
    // for an unknown reason, we get a height of zero
    const doc = iframe.value.contentDocument;

    if (!doc) {
        console.warn('SafeHtmlBox: iframe document not found');
        return;
    }
    const elementComputedStyle = window.getComputedStyle(mainElement.value, null);
    const paddingLeft = parseFloat(elementComputedStyle.getPropertyValue('padding-left'));
    const paddingRight = parseFloat(elementComputedStyle.getPropertyValue('padding-right'));
    const document = doc.documentElement;
    const body = doc.body;
    const height = Math.max(body.scrollHeight, body.offsetHeight, document.offsetHeight);
    iframe.value.width = `${mainElement.value.clientWidth - paddingLeft - paddingRight}px`;
    iframe.value.height = `${height}px`;

    console.log('update size', height);
}

function cleanHtml(html: string) {
    if (html.startsWith('<!DOCTYPE html>')) {
        // Inject <style> tag
        const headCloseIndex = html.indexOf('</head>');
        if (headCloseIndex !== -1) {
            const styleTag = `
<style>
    body {
        padding: 0;
        margin: 0;
    }
    ${props.customCss}
</style>`;
            // Inject before </head>
            return html.slice(0, headCloseIndex) + styleTag + html.slice(headCloseIndex);
        }
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
                    ${props.customCss}
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

useResizeObserver(iframeDocumentHtml, () => {
    updateSize();
});
useResizeObserver(iframeDocumentBody, () => {
    updateSize();
});

function onLoad() {
    const f = iframe.value;
    if (f) {
        iframeDocument.value = f.contentDocument;
        const iframeDoc = f.contentDocument;

        if (!props.allowClicks) {
            iframeDoc?.addEventListener('click', (e) => {
                e.preventDefault(); // block link navigation
            });
        }
        else if (iframeDoc) {
            for (const a of iframeDoc.querySelectorAll('a')) {
                a.setAttribute('target', '_blank');
            }
        }

        // Disable overflow scrolling behaviour on iOS / Mac (bouncy scroll on the iframe)
        if (iframeDoc) {
            iframeDoc.body.style.overflow = 'hidden';
            iframeDoc.documentElement.style.overscrollBehavior = 'none';
        }

        updateSize();
    }
}

function replaceIframeContent(iframeElement: HTMLIFrameElement, newHTML: string) {
    iframeElement.addEventListener('load', onLoad, { once: true });
    iframeElement.srcdoc = cleanHtml(newHTML);
}
</script>
