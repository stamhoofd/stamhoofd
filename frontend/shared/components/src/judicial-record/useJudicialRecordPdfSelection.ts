import { ref } from 'vue';

/**
 * An extract from FOD Justitie is a one or two page text pdf. Anything larger is never the original
 * document, and it is the cap the upload endpoint applies, so the control step stops it in the
 * browser rather than spend a member's upload on something that is going to be refused on arrival.
 */
export const JUDICIAL_RECORD_MAX_PDF_SIZE = 5 * 1024 * 1024;

/**
 * How old an extract may be when it is delivered, the month the member is told about when they
 * request one. The same number the upload endpoint uses, so the control in the browser cannot
 * approve of an age the backend is about to refuse.
 */
export const JUDICIAL_RECORD_MAX_AGE_IN_DAYS = 30;

/**
 * Taking the file that the member either dropped on the view or picked from a file dialog.
 *
 * Nothing about the file is decided here, not even whether it is a pdf: that is the control step's
 * business, so whatever is wrong with a file is said in one place, next to that file.
 */
export function useJudicialRecordPdfSelection(onSelect: (file: File) => void) {
    // dragenter and dragleave also fire when moving over child elements, so count them
    let dragDepth = 0;
    const dragging = ref(false);

    const dropHandlers = {
        dragenter: (event: DragEvent) => {
            event.preventDefault();
            dragDepth += 1;
            dragging.value = true;
        },
        dragover: (event: DragEvent) => {
            event.preventDefault();
        },
        dragleave: () => {
            dragDepth = Math.max(0, dragDepth - 1);
            if (dragDepth === 0) {
                dragging.value = false;
            }
        },
        drop: (event: DragEvent) => {
            event.preventDefault();
            dragDepth = 0;
            dragging.value = false;

            const file = event.dataTransfer?.files[0];
            if (!file) {
                return;
            }
            onSelect(file);
        },
    };

    return { dragging, dropHandlers };
}
