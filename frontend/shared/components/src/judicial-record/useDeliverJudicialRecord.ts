import type { Decoder } from '@common/encoding';
import { JudicialRecordCheckReport } from '@stamhoofd/structures';
import { useContext } from '../hooks/useContext';
import { useRequestOwner } from '../hooks/networking/useRequestOwner';

/**
 * Hands the chosen pdf to the backend and waits for the report of the five automatic checks.
 *
 * The control happens inside this request: no background task and no polling, so the member sees
 * which checks held as soon as it answers. Parsing a pdf and asking an authority about certificates
 * is not instant, hence the generous timeout, and a retry would run the whole control again - the
 * member decides whether that happens, with the button under the result.
 */
export function useDeliverJudicialRecord() {
    const context = useContext();
    const owner = useRequestOwner();

    return async function deliverJudicialRecord(memberId: string, file: File): Promise<JudicialRecordCheckReport> {
        const formData = new FormData();
        formData.append('file', file);

        const response = await context.value.authenticatedServer.request({
            method: 'POST',
            path: `/members/${encodeURIComponent(memberId)}/judicial-record`,
            body: formData,
            decoder: JudicialRecordCheckReport as Decoder<JudicialRecordCheckReport>,
            timeout: 2 * 60 * 1000,
            shouldRetry: false,
            owner,
        });

        return response.data;
    };
}
