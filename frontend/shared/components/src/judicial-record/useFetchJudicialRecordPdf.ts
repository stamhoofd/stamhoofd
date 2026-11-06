import { useContext } from '../hooks/useContext';
import { useRequestOwner } from '../hooks/networking/useRequestOwner';

/**
 * Downloads the extract behind the QR-code on a paper or on-screen extract.
 *
 * The browser cannot fetch it itself: the link points at FOD Justitie, which answers neither CORS
 * headers nor anything we may rely on, so the backend asks for it and hands the bytes over. Nothing
 * is stored on the way, and what comes back continues through the flow exactly like a pdf the member
 * picked themselves.
 *
 * The response is octet-stream rather than pdf on purpose - bytes from outside must never be
 * rendered on the api origin - so the pdf type is put on them here, where they are ours again.
 */
export function useFetchJudicialRecordPdf() {
    const context = useContext();
    const owner = useRequestOwner();

    return async function fetchJudicialRecordPdf(memberId: string, url: string): Promise<File> {
        const response = await context.value.authenticatedServer.request({
            method: 'POST',
            path: `/members/${encodeURIComponent(memberId)}/judicial-record/fetch`,
            body: { url },
            responseType: 'blob',
            // FOD Justitie is a third party we are waiting on, so this is slower than our own endpoints
            timeout: 60 * 1000,
            shouldRetry: false,
            owner,
        });

        return new File([response.data as Blob], 'uittreksel.pdf', { type: 'application/pdf' });
    };
}
