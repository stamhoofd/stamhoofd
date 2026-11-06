<template>
    <div class="judicial-record-pdf-preview" :class="{ 'in-column': inColumn, 'with-pages': pageCount > 1 }">
        <div class="judicial-record-pdf-preview-box">
            <!-- Most extracts are one page, and then there is nothing to page through -->
            <div v-if="pageCount > 1" class="judicial-record-pdf-preview-pages" :style="{ '--digits': pageCount.toString().length }">
                <button v-tooltip="$t('Vorige pagina')" class="button icon arrow-left" type="button" :disabled="pageNumber <= 1" :aria-label="$t('Vorige pagina')" @click="goToPage(pageNumber - 1)" />
                <span class="current">{{ pageNumber }}</span>
                <span>/</span>
                <span>{{ pageCount }}</span>
                <button v-tooltip="$t('Volgende pagina')" class="button icon arrow-right" type="button" :disabled="pageNumber >= pageCount" :aria-label="$t('Volgende pagina')" @click="goToPage(pageNumber + 1)" />
            </div>

            <PdfViewer ref="viewer" :data="data" horizontal :fixed-height="inColumn" @loaded="pageCount = $event.pageCount" @page="pageNumber = $event" @error="emit('error', $event)" @contextmenu="showMenu" />
        </div>
    </div>
</template>

<script setup lang="ts">
import PdfViewer from '@stamhoofd/frontend-pdf-viewer/PdfViewer.vue';
import { ref, useTemplateRef } from 'vue';
import { useKeyDown } from '../hooks/useKeyDown';
import type { ContextMenuItem } from '../overlays/ContextMenu';
import { ContextMenu } from '../overlays/ContextMenu';

const props = defineProps<{
    data: Uint8Array;
    /** Shown in the column next to the view, where it grows with the room the column has */
    inColumn: boolean;
    /** What can be done with the file itself, in the menu of the viewer */
    fileMenuItems: ContextMenuItem[];
}>();

/** A document the viewer cannot draw. The parent offers it another way, so nothing is drawn here instead. */
const emit = defineEmits<{
    (e: 'error', error: Error): void;
}>();

const viewer = useTemplateRef<InstanceType<typeof PdfViewer>>('viewer');
const pageCount = ref(0);
const pageNumber = ref(1);

function goToPage(number: number) {
    if (number >= 1 && number <= pageCount.value) {
        viewer.value?.goToPage(number);
    }
}

useKeyDown((key, { shift, ctrl, alt, meta }) => {
    if (shift || ctrl || alt || meta) {
        return false;
    }
    if (key === 'ArrowLeft' && pageNumber.value > 1) {
        goToPage(pageNumber.value - 1);
        return true;
    }
    if (key === 'ArrowRight' && pageNumber.value < pageCount.value) {
        goToPage(pageNumber.value + 1);
        return true;
    }
    return false;
});

function showMenu(event: MouseEvent) {
    // Selected text gets the menu of the browser, which can copy it
    if (window.getSelection()?.toString()) {
        return;
    }
    event.preventDefault();
    new ContextMenu([props.fileMenuItems]).show({ clickEvent: event }).catch(console.error);
}
</script>

<style lang="scss">
.judicial-record-pdf-preview {
    // The row of page arrows, in the column where the size of the page follows from it
    --judicial-record-pages-height: 0px;

    // The room above the page in the column. The arrows are taller than their icons and leave space
    // of their own, a page on its own needs the usual padding.
    --judicial-record-preview-top: var(--st-horizontal-padding, 30px);

    &.with-pages {
        --judicial-record-pages-height: 40px;
        --judicial-record-preview-top: 10px;
    }
}

.judicial-record-pdf-preview.in-column {
    // The viewer scrolls up and down here, and its scroll area starts 10px above the page to leave room
    // for the shadow. Without this margin a zoomed page scrolls up to right below the arrows.
    &.with-pages {
        --judicial-record-pages-height: 50px;
    }

    .judicial-record-pdf-preview-pages {
        margin-bottom: 10px;
    }

    // Fills the column of the preview panel, like WebshopPreviewCard: the height of that column, less
    // the padding it is given below
    height: calc(var(--vh, 1vh) * 100 - var(--judicial-record-preview-top) - var(--st-horizontal-padding, 30px) - var(--st-safe-area-top, 0px) - var(--st-safe-area-bottom, 0px));
    container-type: size;

    > .judicial-record-pdf-preview-box {
        // One A4 page as large as the column fits below the arrows, limited by its width or its
        // height, but never narrower than in the narrowest column
        width: max(
            calc(var(--preview-panel-width, 450px) - 2 * var(--st-horizontal-padding, 30px)),
            min(100cqw, calc((100cqh - var(--judicial-record-pages-height)) * 595 / 842))
        );

        // Never taller than the column though: in a short one the page scrolls up and down inside the
        // viewer, which scrolls already, instead of the column scrolling around it as well
        .pdf-viewer {
            max-height: calc(100cqh - var(--judicial-record-pages-height));
        }
    }
}

// The column keeps its content as wide as in the narrowest column (see PreviewPanel.vue). The pdf
// takes the room a wider column has.
.preview-panel-column:has(.judicial-record-pdf-preview.in-column) {
    --preview-panel-padding-bottom: calc(var(--st-horizontal-padding) + var(--st-safe-area-bottom, 0px));
    padding: calc(var(--st-horizontal-padding) + var(--st-safe-area-top, 0px)) var(--st-horizontal-padding) var(--preview-panel-padding-bottom);
}

.preview-panel-column:has(.judicial-record-pdf-preview.in-column.with-pages) {
    padding-top: calc(10px + var(--st-safe-area-top, 0px));
}

.judicial-record-pdf-preview-pages {
    display: grid;

    // Both numbers get a column as wide as the page count could be: the font has no tabular digits,
    // but 0 is its widest digit, so --digits × 1ch fits every number. The slash stays centered between
    // the arrows and nothing moves when the page changes.
    grid-template-columns: auto calc(var(--digits) * 1ch) auto calc(var(--digits) * 1ch) auto;
    justify-content: center;
    align-items: center;
    gap: 1px;
    white-space: nowrap;

    // The arrows are taller than their icons and leave enough room below them, so the page reads as
    // the one they turn
    height: 40px;

    > .button {
        // The hover background is wider than the arrow and would otherwise cover the numbers
        margin-inline: 4px;
    }

    > span {
        // Centered on the arrows by the height of the digits, not of the line, like the text of a button
        text-box: trim-both cap alphabetic;
    }

    > .current {
        text-align: right;
    }
}
</style>
