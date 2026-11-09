<template>
    <div ref="el" class="pdf-viewer-page" :style="style">
        <!-- A canvas without an explicit size defaults to 300x150 and allocates it. -->
        <canvas ref="canvasElement" width="0" height="0" />

        <!-- The text of the page, invisible on top of the canvas, so it can be selected and copied -->
        <div ref="textLayerElement" class="textLayer" />

        <p v-if="failed" class="pdf-viewer-page-error">
            {{ $t('Deze pagina kon niet worden weergegeven.') }}
        </p>
    </div>
</template>

<script lang="ts" setup>
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist';
import { RenderingCancelledException, TextLayer } from 'pdfjs-dist';
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue';
import { getRenderScale } from './getRenderScale.ts';

const props = defineProps<{
    document: PDFDocumentProxy;
    pageNumber: number;

    /**
     * Width of the viewer in css pixels, or null while it is still being measured.
     */
    width: number | null;

    /**
     * Width the page is shown at in css pixels. Differs from `width` while a zoom is going on, when
     * the canvas is only stretched; the text on top has to follow what is shown.
     */
    displayWidth: number | null;

    /**
     * Width / height of the first page of the document. A page holds its place in the scroll height
     * with this ratio until it has been loaded itself, which is exact for the documents we show:
     * every page of an extract has the same size.
     */
    defaultAspectRatio: number;
}>();

/**
 * Render a page before it is scrolled into view, and keep it for a while after it leaves, so
 * scrolling back and forth does not repaint. Everything outside this band is dropped again, which
 * is what keeps a long document inside the canvas memory a phone will give us.
 */
const renderMargin = '150%';

const el = useTemplateRef<HTMLElement>('el');
const canvasElement = useTemplateRef<HTMLCanvasElement>('canvasElement');
const textLayerElement = useTemplateRef<HTMLDivElement>('textLayerElement');

const ownAspectRatio = ref<number | null>(null);

/** Width of the page in pdf units, which the text layer is laid out in */
const pageWidth = ref<number | null>(null);
const near = ref(false);
const failed = ref(false);

const aspectRatio = computed(() => ownAspectRatio.value ?? props.defaultAspectRatio);

const style = computed(() => ({
    aspectRatio: `${aspectRatio.value}`,
    // pdf.js sizes the text layer with these: css pixels per pdf unit, rounded to whole pixels
    '--total-scale-factor': props.displayWidth !== null && pageWidth.value !== null ? `${props.displayWidth / pageWidth.value}` : undefined,
    '--scale-round-x': '1px',
    '--scale-round-y': '1px',
}));

let page: PDFPageProxy | null = null;
let task: RenderTask | null = null;

/**
 * Laid out once per page and kept: it follows the zoom through `--total-scale-factor`, so unlike the
 * canvas it never has to be drawn again.
 */
let textLayer: TextLayer | null = null;

function clearTextLayer() {
    textLayer?.cancel();
    textLayer = null;
    textLayerElement.value?.replaceChildren();
}

async function renderTextLayer(loadedPage: PDFPageProxy) {
    const container = textLayerElement.value;
    if (textLayer || !container) {
        return;
    }

    textLayer = new TextLayer({
        textContentSource: loadedPage.streamTextContent(),
        container,
        viewport: loadedPage.getViewport({ scale: 1 }),
    });

    try {
        await textLayer.render();
    }
    catch (error) {
        // Only the selection is missing then: the page itself is on the canvas
        if (!(error instanceof Error && error.name === 'AbortException')) {
            console.error('Failed to lay out the text of pdf page', props.pageNumber, error);
        }
    }
}

/**
 * Incremented on every render and discard, so an await that resolves after the next one started
 * knows it is painting into a canvas that has moved on.
 */
let generation = 0;

function cancelRender() {
    task?.cancel();
    task = null;
}

function discard() {
    generation++;
    cancelRender();

    const canvas = canvasElement.value;
    if (canvas) {
        // Resizing to zero is what actually frees the backing store; clearRect only paints over it.
        canvas.width = 0;
        canvas.height = 0;
    }

    page?.cleanup();
}

async function render() {
    const canvas = canvasElement.value;
    const width = props.width;

    if (!canvas || width === null || width <= 0 || !near.value) {
        return;
    }

    cancelRender();
    const current = ++generation;

    try {
        if (!page) {
            const loaded = await props.document.getPage(props.pageNumber);
            if (current !== generation) {
                return;
            }
            page = loaded;
        }

        const unscaled = page.getViewport({ scale: 1 });
        ownAspectRatio.value = unscaled.width / unscaled.height;
        pageWidth.value = unscaled.width;

        const scale = getRenderScale({
            cssWidth: width,
            pageWidth: unscaled.width,
            pageHeight: unscaled.height,
            pixelRatio: window.devicePixelRatio,
        });
        const viewport = page.getViewport({ scale });

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);

        task = page.render({ canvas, viewport });
        await task.promise;

        if (current === generation) {
            task = null;
            failed.value = false;
            void renderTextLayer(page);
        }
    }
    catch (error) {
        if (current !== generation || error instanceof RenderingCancelledException) {
            return;
        }
        console.error('Failed to render pdf page', props.pageNumber, error);
        failed.value = true;
    }
}

watch(() => [props.document, props.pageNumber], () => {
    discard();
    clearTextLayer();
    page = null;
    ownAspectRatio.value = null;
    pageWidth.value = null;
    failed.value = false;
    void render();
});

watch([() => props.width, near], () => {
    if (near.value) {
        void render();
    }
    else {
        discard();
    }
});

onMounted(() => {
    if (!el.value) {
        return;
    }

    try {
        const observer = new IntersectionObserver((entries) => {
            near.value = entries[entries.length - 1].isIntersecting;
        }, { rootMargin: `${renderMargin} 0px` });
        observer.observe(el.value);

        onBeforeUnmount(() => observer.disconnect());
    }
    catch (error) {
        // Without an IntersectionObserver every page renders at once, which still works.
        console.error('No IntersectionObserver, rendering all pdf pages at once', error);
        near.value = true;
    }
});

onBeforeUnmount(() => {
    discard();
    clearTextLayer();
});
</script>

<style lang="scss">
@use '@stamhoofd/scss/base/variables' as *;
@use '@stamhoofd/scss/base/text-styles' as *;

.pdf-viewer-page {
    position: relative;
    width: 100%;
    border-radius: $border-radius;
    overflow: hidden;

    // A pdf page keeps its own paper colour in dark mode: it is a document, not part of the app.
    background: white;
    box-shadow: 0 2px 10px $color-shadow;

    > canvas {
        display: block;
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
    }

    // What pdf.js's own viewer sets on its text layer (pdfjs-dist/web/pdf_viewer.css), without the
    // highlighting and editing it does not use here: transparent text in the place of the drawn text.
    > .textLayer {
        position: absolute;
        inset: 0;
        overflow: clip;
        color-scheme: only light;
        text-align: initial;
        line-height: 1;
        letter-spacing: normal;
        word-spacing: normal;
        text-size-adjust: none;
        forced-color-adjust: none;
        transform-origin: 0 0;
        caret-color: CanvasText;
        z-index: 0;

        --min-font-size: 1;
        --text-scale-factor: calc(var(--total-scale-factor) * var(--min-font-size));
        --min-font-size-inv: calc(1 / var(--min-font-size));

        :is(span, br) {
            color: transparent;
            position: absolute;
            white-space: pre;
            cursor: text;
            transform-origin: 0% 0%;
            user-select: text;
        }

        > :not(.markedContent), .markedContent span:not(.markedContent) {
            z-index: 1;

            --font-height: 0;
            font-size: calc(var(--text-scale-factor) * var(--font-height));

            --scale-x: 1;
            --rotate: 0deg;
            transform: rotate(var(--rotate)) scaleX(var(--scale-x)) scale(var(--min-font-size-inv));
        }

        .markedContent {
            display: contents;
        }

        span[role="img"] {
            user-select: none;
            cursor: default;
        }

        ::selection {
            background: rgba(0 0 255 / 0.25);
            background: color-mix(in srgb, AccentColor, transparent 50%);
            color: transparent;
        }

        br::selection {
            background: transparent;
        }

        // Keeps a selection that is dragged past the last line from jumping to the start of the page
        .endOfContent {
            display: block;
            position: absolute;
            inset: 100% 0 0;
            z-index: 0;
            cursor: default;
            user-select: none;
        }

        &.selecting .endOfContent {
            top: 0;
        }
    }

    > .pdf-viewer-page-error {
        @extend %style-description;

        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        text-align: center;

        // The page stays white, so this text cannot follow the theme.
        color: $color-gray-4-original;
    }
}
</style>
