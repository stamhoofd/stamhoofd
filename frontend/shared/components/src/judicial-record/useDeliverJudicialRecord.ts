import type { Decoder } from '@common/encoding';
import type { JudicialRecordDeliveryStatus } from '@stamhoofd/structures';
import { JudicialRecordDeliveryResponse } from '@stamhoofd/structures';
import { useContext } from '../hooks/useContext';
import { useRequestOwner } from '../hooks/networking/useRequestOwner';

/**
 * Hands the chosen pdf to the backend, which answers whether the extract is approved or whether a
 * person will look at it.
 *
 * The browser already ran the same five checks before this is called, so this is not where the
 * member finds out what is wrong with their document. It is the backend that decides, though: it
 * runs them again on what it actually received, and looks up whether a certificate was revoked -
 * a network call that has no business in code the browser runs.
 *
 * Parsing a pdf and asking an authority about certificates is not instant, hence the generous
 * timeout, and a retry runs the whole thing again, which is why the member asks for it.
 */
export function useDeliverJudicialRecord() {
    const context = useContext();
    const owner = useRequestOwner();

    return async function deliverJudicialRecord(memberId: string, file: File): Promise<JudicialRecordDeliveryStatus> {
        const formData = new FormData();
        formData.append('file', file);

        const response = await context.value.authenticatedServer.request({
            method: 'POST',
            path: `/members/${encodeURIComponent(memberId)}/judicial-record`,
            body: formData,
            decoder: JudicialRecordDeliveryResponse as Decoder<JudicialRecordDeliveryResponse>,
            timeout: 2 * 60 * 1000,
            shouldRetry: false,
            owner,
        });

        return response.data.status;
    };
}
