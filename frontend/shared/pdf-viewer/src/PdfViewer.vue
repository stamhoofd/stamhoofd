<template>
    <div ref="el" class="pdf-viewer">
        <p v-if="failed" class="error-box">
            {{ $t('Deze pdf kon niet worden geopend.') }}
        </p>

        <template v-else-if="pdf">
            <PdfViewerPage
                v-for="pageNumber in pdf.numPages"
                :key="pageNumber"
                :document="pdf"
                :page-number="pageNumber"
                :width="width"
                :default-aspect-ratio="defaultAspectRatio"
            />
        </template>

        <div v-else class="pdf-viewer-loading" :style="{ aspectRatio: `${defaultAspectRatio}` }" />
    </div>
</template>

<script lang="ts" setup>
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { onBeforeUnmount, onMounted, ref, shallowRef, useTemplateRef, watch } from 'vue';
import PdfViewerPage from './PdfViewerPage.vue';
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
const pdf = shallowRef<PDFDocumentProxy | null>(null);

const width = ref<number | null>(null);
const defaultAspectRatio = ref(a4AspectRatio);
const failed = ref(false);

/**
 * Incremented on every load, so a document that resolves after `data` already changed again is
 * thrown away instead of shown.
 */
let generation = 0;

async function unload() {
    const previous = pdf.value;
    pdf.value = null;

    if (previous) {
        await previous.loadingTask.destroy();
    }
}

async function load(data: Uint8Array) {
    const current = ++generation;
    failed.value = false;
    await unload();

    try {
        const loaded = await loadPdfDocument(data);

        if (current !== generation) {
            await loaded.loadingTask.destroy();
            return;
        }

        // The first page sets the height every other page holds until it is loaded itself.
        const firstPage = await loaded.getPage(1);
        const viewport = firstPage.getViewport({ scale: 1 });

        if (current !== generation) {
            await loaded.loadingTask.destroy();
            return;
        }

        defaultAspectRatio.value = viewport.width / viewport.height;
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
        width.value = el.value.clientWidth;
    }
}

watch(() => props.data, (data) => {
    void load(data);
}, { immediate: true });

onMounted(() => {
    updateWidth();

    if (!el.value) {
        return;
    }

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
}
</style>
