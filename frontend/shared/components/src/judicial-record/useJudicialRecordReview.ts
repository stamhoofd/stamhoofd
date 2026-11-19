import type { Decoder } from '@common/encoding';
import type { JudicialRecordReviewDecision, MembersBlob } from '@stamhoofd/structures';
import { JudicialRecordReviewView, MembersBlob as MembersBlobStruct } from '@stamhoofd/structures';
import { useContext } from '../hooks/useContext';
import { useRequestOwner } from '../hooks/networking/useRequestOwner';

/**
 * Downloads the extract a member delivered, for a reviewer to look at.
 *
 * The backend answers octet-stream, because nothing that came from outside is ever rendered on the api
 * origin, so the pdf type is put on the bytes here - the viewer reads them, it does not open a url.
 */
export function useJudicialRecordDocument() {
    const context = useContext();
    const owner = useRequestOwner();

    return async function fetchJudicialRecordDocument(memberId: string): Promise<Uint8Array> {
        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: `/members/${encodeURIComponent(memberId)}/judicial-record/document`,
            responseType: 'arraybuffer',
            shouldRetry: false,
            owner,
        });

        return new Uint8Array(response.data as ArrayBuffer);
    };
}

/** What was decided about this member's extract before, and by whom. Only a reviewer may read it. */
export function useJudicialRecordReviewView() {
    const context = useContext();
    const owner = useRequestOwner();

    return async function fetchJudicialRecordReviewView(memberId: string): Promise<JudicialRecordReviewView> {
        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: `/members/${encodeURIComponent(memberId)}/judicial-record/review`,
            decoder: JudicialRecordReviewView as Decoder<JudicialRecordReviewView>,
            shouldRetry: false,
            owner,
        });

        return response.data;
    };
}

/**
 * Records the decision. Answers with the member, because the status the rest of the application reads is
 * derived from the record together with the member's responsibilities and age - the client is told it rather
 * than working out what the outcome implies.
 */
export function useSubmitJudicialRecordReview() {
    const context = useContext();
    const owner = useRequestOwner();

    return async function submitJudicialRecordReview(memberId: string, reviewDecision: JudicialRecordReviewDecision, comment: string | null): Promise<MembersBlob> {
        const response = await context.value.authenticatedServer.request({
            method: 'POST',
            path: `/members/${encodeURIComponent(memberId)}/judicial-record/review`,
            body: { reviewDecision, comment },
            decoder: MembersBlobStruct as Decoder<MembersBlob>,
            shouldRetry: false,
            owner,
        });

        return response.data;
    };
}
