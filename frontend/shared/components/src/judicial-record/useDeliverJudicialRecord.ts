import type { Decoder } from '@common/encoding';
import type { JudicialRecordStatus } from '@stamhoofd/structures';
import { JudicialRecordDeliveryResponse } from '@stamhoofd/structures';
import { useContext } from '../hooks/useContext';
import { useRequestOwner } from '../hooks/networking/useRequestOwner';

/**
 * Hands the chosen pdf to the backend, which runs the same five checks again on what it actually
 * received and looks up whether the certificate was revoked - a network call that has no business in
 * code the browser runs. That makes it, not the browser, the one that decides.
 *
 * Parsing a pdf and asking an authority about certificates is not instant, hence the timeout, and a
 * retry runs the whole thing again, which is why the member asks for it instead of the client.
 */
export function useDeliverJudicialRecord() {
    const context = useContext();
    const owner = useRequestOwner();

    return async function deliverJudicialRecord(memberId: string, file: File): Promise<JudicialRecordStatus> {
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
