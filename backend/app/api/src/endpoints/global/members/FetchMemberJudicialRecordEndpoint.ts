import type { Decoder } from '@common/encoding';
import { AutoEncoder, StringDecoder, field } from '@common/encoding';
import { SimpleError } from '@common/errors';
import type { DecodedRequest, Request } from '@node/endpoints';
import { Endpoint, Response } from '@node/endpoints';
import { Member, RateLimiter } from '@stamhoofd/models';
import { Context } from '../../../helpers/Context.js';
import { MAXIMUM_UPLOAD_SIZE } from './DeliverMemberJudicialRecordEndpoint.js';

type Params = { id: string };
type Query = undefined;
class Body extends AutoEncoder {
    /** The url printed on the extract, as the scanner read it off the QR code. */
    @field({ decoder: StringDecoder })
    url: string;
}
type ResponseBody = Buffer;

/** Where an extract of FOD Justitie is served, and the only origin we ever call. */
const FOD_JUSTITIE_ORIGIN = 'https://just-crimeviewer-ctz.just.fgov.be';

/**
 * The one url shape FOD Justitie prints on an extract. Fully anchored, and the uuid is the only
 * thing it captures: the url that is fetched is rebuilt from that capture, so no other part of what
 * the caller sent reaches the request.
 */
export const FOD_JUSTITIE_RECORD_URL_PATTERN = /^https:\/\/just-crimeviewer-ctz\.just\.fgov\.be\/record\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-CJCS$/;

/** FOD Justitie answers in well under a second; a call that hangs is a call the member waits on. */
export const FETCH_TIMEOUT_IN_MS = 10 * 1000;

/** As many attempts as delivering allows: one scan leads to one delivery. */
export const judicialRecordFetchMemberLimiter = new RateLimiter({
    limits: [
        {
            limit: 10,
            duration: 60 * 60 * 1000,
        },
        {
            limit: 20,
            duration: 24 * 60 * 60 * 1000,
        },
    ],
});

/** One account scans for its whole family, so its limit is the looser of the two. */
export const judicialRecordFetchUserLimiter = new RateLimiter({
    limits: [
        {
            limit: 30,
            duration: 60 * 60 * 1000,
        },
        {
            limit: 60,
            duration: 24 * 60 * 60 * 1000,
        },
    ],
});

/**
 * Fetching an extract from the judicial record for a member: the url off the QR code goes in, the
 * pdf comes out. Nothing is stored, neither the url nor the document.
 *
 * It exists because the browser cannot make this call itself - the viewer of FOD Justitie answers
 * without any cross-origin header - so the member scans the QR code and we fetch what it points at.
 * The bytes go straight back to them, and they deliver them with the endpoint next door.
 *
 * Which is also why the audience is the same as there, the member themselves and their parents: an
 * extract is theirs, and this endpoint hands one out.
 *
 * Everything that comes back is untrusted input. FOD Justitie is who they say they are - the
 * certificate of the origin says so - but a document behind one of their urls is not something they
 * drew up themselves in every case, so the response is read under a cap, with no redirect followed,
 * and only handed on when it is a pdf. Whether it is a *valid* extract is not decided here: that is
 * what the five checks of the delivery are for.
 */
export class FetchMemberJudicialRecordEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = Body as Decoder<Body>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/members/@id/judicial-record/fetch', { id: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await Context.setOptionalOrganizationScope();
        const { user } = await Context.authenticate();

        const member = await Member.getByIdWithUsers(request.params.id);

        // Only the member and their parents, as with delivering: see the note on the class
        if (!member || !Context.auth.isUserManager(member)) {
            throw Context.auth.memberNotFoundOrNoAccess();
        }

        const url = this.parseUrl(request.body.url);

        this.trackLimits(user.id, member.id);

        const response = new Response(await this.readPdf(url));
        response.headers['content-type'] = 'application/octet-stream';

        // The pdf is somebody else's document: it is never rendered on our own origin
        response.headers['content-disposition'] = 'attachment; filename="uittreksel.pdf"';
        response.headers['x-content-type-options'] = 'nosniff';

        return response;
    }

    /**
     * Rebuilds the url from the uuid of the one accepted shape, which rejects everything else: any
     * other host, scheme, port, path, query or fragment.
     */
    private parseUrl(value: string): string {
        const match = FOD_JUSTITIE_RECORD_URL_PATTERN.exec(value);
        const url = match ? `${FOD_JUSTITIE_ORIGIN}/record/${match[1]}-CJCS` : null;

        // Compared whole, because `$` in JavaScript also matches before a trailing newline
        if (url === null || url !== value) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Not a url of FOD Justitie',
                human: $t('Deze QR-code komt niet van FOD Justitie. Scan de QR-code op het uittreksel dat je van FOD Justitie kreeg.'),
                field: 'url',
                statusCode: 400,
            });
        }

        return url;
    }

    /**
     * A call we make on behalf of whoever asked, so it is limited like the delivery it leads to.
     * The two are counted apart: fetching is the cheaper of the two and failing at it - a link that
     * was already used, a scan that went wrong - should not use up attempts at delivering.
     */
    private trackLimits(userId: string, memberId: string) {
        try {
            judicialRecordFetchUserLimiter.track(userId, 1);
            judicialRecordFetchMemberLimiter.track(memberId, 1);
        } catch (error) {
            throw new SimpleError({
                code: 'too_many_requests',
                message: 'Too many judicial record fetches',
                human: $t('Je hebt te veel uittreksels opgehaald. Probeer het later opnieuw.'),
                statusCode: 429,
            });
        }
    }

    private async readPdf(url: string): Promise<Buffer> {
        let response: globalThis.Response;

        try {
            response = await fetch(url, {
                method: 'GET',
                // The url is one of ours by now, so it is never followed anywhere else
                redirect: 'error',
                signal: AbortSignal.timeout(FETCH_TIMEOUT_IN_MS),
                credentials: 'omit',
                referrerPolicy: 'no-referrer',
            });
        } catch (error) {
            throw this.notAPdf();
        }

        if (!response.ok || !response.body) {
            // The status, and nothing else of the response: its body is not ours to repeat
            console.error('[judicial-record] FOD Justitie answered status', response.status);
            throw this.notAPdf();
        }

        const contentType = response.headers.get('content-type') ?? '';

        if (!contentType.toLowerCase().startsWith('application/pdf')) {
            throw this.notAPdf();
        }

        const bytes = await this.readCapped(response.body);

        // An extract that is not a pdf at all is not worth parsing further up
        if (bytes.subarray(0, 5).toString('latin1') !== '%PDF-') {
            throw this.notAPdf();
        }

        return bytes;
    }

    /**
     * Reads the response chunk by chunk and stops at the cap, rather than reading it whole and
     * measuring afterwards: what is on the other end decides how much it sends.
     */
    private async readCapped(body: ReadableStream<Uint8Array>): Promise<Buffer> {
        const reader = body.getReader();
        const chunks: Uint8Array[] = [];
        let size = 0;

        try {
            for (;;) {
                const { done, value } = await reader.read();

                if (done) {
                    break;
                }

                size += value.length;

                if (size > MAXIMUM_UPLOAD_SIZE) {
                    throw this.notAPdf();
                }

                chunks.push(value);
            }
        } finally {
            await reader.cancel().catch(() => undefined);
        }

        return Buffer.concat(chunks);
    }

    /**
     * The one answer for every way this can end without a pdf in hand: a link that was already
     * used or has expired, a page instead of a document, a response too large, no answer at all.
     * They are one thing to the member, and the thing to do about it is always the same.
     */
    private notAPdf(): SimpleError {
        return new SimpleError({
            code: 'judicial_record_not_available',
            message: 'FOD Justitie did not return a pdf',
            human: $t('We konden je uittreksel niet ophalen bij FOD Justitie. Een link werkt maar één keer: vraag een nieuw uittreksel aan en scan de QR-code opnieuw.'),
            statusCode: 400,
        });
    }
}
