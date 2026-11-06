<template>
    <div ref="el" class="pdf-viewer-page" :style="{ aspectRatio: `${aspectRatio}` }">
        <!-- A canvas without an explicit size defaults to 300x150 and allocates it. -->
        <canvas ref="canvasElement" width="0" height="0" />

        <p v-if="failed" class="pdf-viewer-page-error">
            {{ $t('Deze pagina kon niet worden weergegeven.') }}
        </p>
    </div>
</template>

<script lang="ts" setup>
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist';
import { RenderingCancelledException } from 'pdfjs-dist';
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

const ownAspectRatio = ref<number | null>(null);
const near = ref(false);
const failed = ref(false);

const aspectRatio = computed(() => ownAspectRatio.value ?? props.defaultAspectRatio);

let page: PDFPageProxy | null = null;
let task: RenderTask | null = null;

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
    page = null;
    ownAspectRatio.value = null;
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
