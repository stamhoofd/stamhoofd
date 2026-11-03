import { SimpleError } from '@common/errors';
import { FOD_JUSTITIE_SIGNATURE_POLICY, verifyPdfSignature } from '@stamhoofd/pdf-verify-core';
import { Formatter } from '@stamhoofd/utility';
import { ref } from 'vue';
import { ErrorBox } from '../errors/ErrorBox';

/**
 * An extract from FOD Justitie is a one or two page text pdf. Anything larger is never the original
 * document, so we stop it in the browser instead of uploading it.
 */
export const JUDICIAL_RECORD_MAX_PDF_SIZE = 10 * 1024 * 1024;

/**
 * How old an extract may be when it is delivered, the month the member is told about when they
 * request one. The backend has its own copy of this and is the one that decides: this one only
 * keeps the browser from uploading a document the backend is going to refuse anyway.
 */
export const JUDICIAL_RECORD_MAX_AGE_IN_DAYS = 31;

/**
 * Accepting a pdf that the member either dropped on the view or picked from a file dialog.
 *
 * Three things are decided here, in this order, each one cheaper than the one after it: whether the
 * file is a pdf at all, whether it is small enough that it could be an extract, and whether FOD
 * Justitie really signed it and nothing changed since. The last one is the whole reason a scan or a
 * photo of an extract is refused, and it runs on the member's own machine, so a document that was
 * never going to pass never leaves it.
 *
 * None of this is a security measure: it only spares the member an upload and a wait. The backend
 * verifies the same signature again, against the same pinned signer, regardless of what the browser
 * concluded - it has to, since nothing stops a client from skipping this.
 */
export function useJudicialRecordPdfSelection(onSelect: (file: File) => void) {
    const errorBox = ref<ErrorBox | null>(null);

    /** The signature check parses a pdf and verifies a certificate chain, so it is not instant. */
    const verifying = ref(false);

    // dragenter and dragleave also fire when moving over child elements, so count them
    let dragDepth = 0;
    const dragging = ref(false);

    async function selectFile(file: File) {
        if (verifying.value) {
            return;
        }

        if (file.type !== 'application/pdf') {
            errorBox.value = new ErrorBox(new SimpleError({
                code: 'invalid_field',
                message: $t('Kies de pdf die je van FOD Justitie kreeg. Een scan of foto kunnen we niet controleren.'),
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
        verifying.value = true;

        try {
            await verifyPdfSignature(new Uint8Array(await file.arrayBuffer()), FOD_JUSTITIE_SIGNATURE_POLICY, JUDICIAL_RECORD_MAX_AGE_IN_DAYS);
        }
        catch (error) {
            // The package answers with a sentence for whoever chose the file - which step refused it
            // and what to do about it - so it is shown as it is.
            errorBox.value = new ErrorBox(error);
            return;
        }
        finally {
            verifying.value = false;
        }

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
            selectFile(file).catch(console.error);
        },
    };

    return { errorBox, dragging, verifying, selectFile, dropHandlers };
}
