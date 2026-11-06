import { SimpleError } from '@common/errors';
import { Formatter } from '@stamhoofd/utility';
import { ref } from 'vue';
import { ErrorBox } from '../errors/ErrorBox';

/**
 * An extract from FOD Justitie is a one or two page text pdf. Anything larger is never the original
 * document, and it is the cap the upload endpoint applies, so we stop it in the browser rather than
 * spend a member's upload on something that is going to be refused on arrival.
 */
export const JUDICIAL_RECORD_MAX_PDF_SIZE = 5 * 1024 * 1024;

/**
 * How old an extract may be when it is delivered, the month the member is told about when they
 * request one. The same number the upload endpoint uses, so the control in the browser cannot
 * approve of an age the backend is about to refuse.
 */
export const JUDICIAL_RECORD_MAX_AGE_IN_DAYS = 30;

/**
 * Accepting a pdf that the member either dropped on the view or picked from a file dialog.
 *
 * Only two things are decided here: whether the file is a pdf at all, and whether it is small enough
 * that it could be an extract. Everything about the document itself - the signature included - is
 * the control step's business, so a member who picked the wrong file is not told about it twice, and
 * never before they have seen what they picked.
 *
 * A file that is not a pdf is the one case we can answer right away, and the answer is the
 * QR-code scanner: a scan or a photo of an extract can never be checked, the code on it can.
 */
export function useJudicialRecordPdfSelection(onSelect: (file: File) => void) {
    const errorBox = ref<ErrorBox | null>(null);

    // dragenter and dragleave also fire when moving over child elements, so count them
    let dragDepth = 0;
    const dragging = ref(false);

    function selectFile(file: File) {
        if (file.type !== 'application/pdf') {
            errorBox.value = new ErrorBox(new SimpleError({
                code: 'invalid_field',
                message: $t('Dit is geen pdf. Kies de pdf die je van FOD Justitie kreeg, of scan de QR-code op je uittreksel.'),
            }));
            return;
        }

        if (file.size > JUDICIAL_RECORD_MAX_PDF_SIZE) {
            errorBox.value = new ErrorBox(new SimpleError({
                code: 'file_too_large',
                message: $t('Dit bestand is te groot (maximaal {size}). Een uittreksel van FOD Justitie is veel kleiner, dus dit is wellicht niet het juiste bestand.', { size: Formatter.fileSize(JUDICIAL_RECORD_MAX_PDF_SIZE) }),
            }));
            return;
        }

        errorBox.value = null;
        onSelect(file);
    }

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
            selectFile(file);
        },
    };

    return { errorBox, dragging, selectFile, dropHandlers };
}
