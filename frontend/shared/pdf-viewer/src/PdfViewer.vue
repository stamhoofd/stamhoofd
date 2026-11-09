<template>
    <div ref="el" class="pdf-viewer" :class="{ zoomed: zoom > 1 }" :style="rootStyle">
        <p v-if="failed" class="error-box">
            {{ $t('Deze pdf kon niet worden geopend.') }}
        </p>

        <template v-else-if="pdf">
            <PdfViewerPage
                v-for="pageNumber in pdf.document.numPages"
                :key="pageNumber"
                :document="pdf.document"
                :page-number="pageNumber"
                :width="renderWidth"
                :display-width="displayWidth"
                :default-aspect-ratio="defaultAspectRatio"
            />
        </template>

        <div v-else class="pdf-viewer-loading" :style="{ aspectRatio: `${defaultAspectRatio}` }" />
    </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, useTemplateRef, watch } from 'vue';
import PdfViewerPage from './PdfViewerPage.vue';
import { listenForZoom } from './listenForZoom.ts';
import type { LoadedPdf } from './loadPdfDocument.ts';
import { loadPdfDocument } from './loadPdfDocument.ts';

const props = defineProps<{
    data: Uint8Array;
}>();

const emit = defineEmits<{
    (e: 'error', error: Error): void;
}>();

/**
 * A4, the size of every extract we show. Only used for the placeholder shown while the document
 * loads; from then on the real size of the first page takes over.
 */
const a4AspectRatio = 595 / 842;

const el = useTemplateRef<HTMLElement>('el');

// pdf.js hands out class instances with their own internals; making them deeply reactive would
// both cost and break them.
const pdf = shallowRef<LoadedPdf | null>(null);

const width = ref<number | null>(null);
const defaultAspectRatio = ref(a4AspectRatio);
const failed = ref(false);

/**
 * How many times wider than the viewer a page is. Never below 1: a page that fits the viewer already
 * shows all of itself.
 */
const zoom = ref(1);
const minZoom = 1;
const maxZoom = 4;

/**
 * The zoom the pages are drawn at. It catches up with `zoom` once a gesture pauses: until then the
 * pages are stretched with css, since drawing them again on every step of a pinch is too slow.
 */
const renderZoom = ref(1);
let renderZoomTimeout: ReturnType<typeof setTimeout> | null = null;

const renderWidth = computed(() => width.value === null ? null : width.value * renderZoom.value);
const displayWidth = computed(() => width.value === null ? null : width.value * zoom.value);

const rootStyle = computed(() => ({
    '--pdf-viewer-zoom': `${zoom.value}`,
}));

/**
 * Incremented on every load, so a document that resolves after `data` already changed again is
 * thrown away instead of shown.
 */
let generation = 0;

async function unload() {
    const previous = pdf.value;
    pdf.value = null;

    if (previous) {
        await previous.destroy();
    }
}

async function load(data: Uint8Array) {
    const current = ++generation;
    failed.value = false;
    await unload();

    try {
        const loaded = await loadPdfDocument(data);

        if (current !== generation) {
            await loaded.destroy();
            return;
        }

        // The first page sets the height every other page holds until it is loaded itself.
        const firstPage = await loaded.document.getPage(1);
        const viewport = firstPage.getViewport({ scale: 1 });

        if (current !== generation) {
            await loaded.destroy();
            return;
        }

        defaultAspectRatio.value = viewport.width / viewport.height;
        zoom.value = 1;
        renderZoom.value = 1;
        pdf.value = loaded;
    }
    catch (error) {
        if (current !== generation) {
            return;
        }

        failed.value = true;
        emit('error', error instanceof Error ? error : new Error(String(error)));
    }
}

function updateWidth() {
    if (el.value) {
        // Without the padding, which a zoomed viewer has to leave room for the page shadows
        const style = getComputedStyle(el.value);
        width.value = el.value.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    }
}

watch(() => props.data, (data) => {
    void load(data);
}, { immediate: true });

/** The parent scrolls down through the pages; the viewer itself only scrolls sideways */
function getVerticalScroller(element: HTMLElement): HTMLElement | null {
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        const overflowY = getComputedStyle(parent).overflowY;
        if ((overflowY === 'auto' || overflowY === 'scroll') && parent.scrollHeight > parent.clientHeight) {
            return parent;
        }
    }
    return null;
}

async function zoomAt(scaleFactor: number, origin: [number, number]) {
    const root = el.value;
    if (!root || !pdf.value) {
        return;
    }

    const next = Math.min(maxZoom, Math.max(minZoom, zoom.value * scaleFactor));
    const ratio = next / zoom.value;
    if (ratio === 1) {
        return;
    }

    // Where the origin is in the pages, so it can stay under the pointer or the fingers. The gaps
    // between the pages do not grow along, which is close enough for a page or two.
    const rect = root.getBoundingClientRect();
    const style = getComputedStyle(root);
    const x = origin[0] - rect.left - parseFloat(style.paddingLeft) + root.scrollLeft;
    const scroller = getVerticalScroller(root);
    const y = origin[1] - rect.top;

    zoom.value = next;
    await nextTick();

    root.scrollLeft += x * (ratio - 1);
    if (scroller) {
        scroller.scrollTop += y * (ratio - 1);
    }

    if (renderZoomTimeout) {
        clearTimeout(renderZoomTimeout);
    }
    renderZoomTimeout = setTimeout(() => {
        renderZoomTimeout = null;
        renderZoom.value = zoom.value;
    }, 250);
}

function panBy(dx: number, dy: number) {
    const root = el.value;
    if (!root) {
        return;
    }

    root.scrollLeft -= dx;
    const scroller = getVerticalScroller(root);
    if (scroller) {
        scroller.scrollTop -= dy;
    }
}

const zoomAbortController = new AbortController();

onMounted(() => {
    updateWidth();

    if (!el.value) {
        return;
    }

    listenForZoom(el.value, {
        signal: zoomAbortController.signal,
        onZoom: (scaleFactor, origin) => void zoomAt(scaleFactor, origin),
        onPan: panBy,
    });

    try {
        const observer = new ResizeObserver(() => updateWidth());
        observer.observe(el.value);

        onBeforeUnmount(() => observer.disconnect());
    }
    catch (error) {
        // Without a ResizeObserver the pages keep the resolution they were first rendered at.
        console.error('No ResizeObserver, pdf pages will not be re-rendered on resize', error);
    }
});

onBeforeUnmount(() => {
    generation++;
    void unload();
    zoomAbortController.abort();

    if (renderZoomTimeout) {
        clearTimeout(renderZoomTimeout);
    }
});
</script>

<style lang="scss">
@use '@stamhoofd/scss/base/variables' as *;

.pdf-viewer {
    display: flex;
    flex-direction: column;
    gap: 15px;

    > .pdf-viewer-loading {
        width: 100%;
        background: $color-background-shade;
        border-radius: $border-radius;
    }

    &.zoomed {
        align-items: flex-start;
        overflow-x: auto;
        overscroll-behavior-x: contain;

        // A scroll area clips what sticks out of it, so this leaves room for the shadow of the pages
        padding: 10px;
        margin: -10px;

        > .pdf-viewer-page {
            flex-shrink: 0;
            width: calc(100% * var(--pdf-viewer-zoom));
        }
    }
}
</style>
