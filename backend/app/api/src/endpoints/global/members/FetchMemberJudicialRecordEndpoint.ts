import type { Decoder } from '@common/encoding';
import { AutoEncoder, StringDecoder, field } from '@common/encoding';
import { SimpleError } from '@common/errors';
import type { DecodedRequest, Request } from '@node/endpoints';
import { Endpoint, Response } from '@node/endpoints';
import { readJudicialRecordExtractUrl } from '@stamhoofd/judicial-record-check';
import { Member, RateLimiter } from '@stamhoofd/models';
import { Context } from '../../../helpers/Context.js';
import { MAXIMUM_UPLOAD_SIZE } from './DeliverMemberJudicialRecordEndpoint.js';

type Params = { id: string };
type Query = undefined;
class Body extends AutoEncoder {
    @field({ decoder: StringDecoder })
    url: string;
}
type ResponseBody = Buffer;

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
 * This exists because the browser cannot make the call itself: the viewer of FOD Justitie answers
 * without any cross-origin header. So the member scans the QR code, we fetch what it points at, and
 * the bytes go straight back for them to deliver with the endpoint next door - which is why the
 * audience is the same as there, the member themselves and their parents.
 *
 * Nothing is stored or logged, neither the url nor the document: the url alone says which extract
 * belongs to whom.
 *
 * Whether the pdf is a *valid* extract is not decided here, but at the delivery.
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

        if (!member || !Context.auth.isUserManager(member)) {
            throw Context.auth.memberNotFoundOrNoAccess();
        }

        const url = this.parseUrl(request.body.url);

        this.trackLimits(user.id, member.id);

        const response = new Response(await this.readPdf(url));

        // Bytes from outside are never rendered on the api origin, whatever they turn out to hold
        response.headers['content-type'] = 'application/octet-stream';
        response.headers['content-disposition'] = 'attachment; filename="uittreksel.pdf"';
        response.headers['x-content-type-options'] = 'nosniff';

        return response;
    }

    /**
     * The url that is fetched is rebuilt from the uuid the shape captures, so no other part of what
     * the caller sent reaches the outbound request.
     *
     * The shape is shared rather than written here because the QR-code scanner that produces a url
     * and the reading of the one an extract prints in words have to agree with this endpoint: a url
     * the scanner accepts and this refuses is a dead end a member cannot get out of.
     */
    private parseUrl(value: string): string {
        const url = readJudicialRecordExtractUrl(value);

        if (url === null) {
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
     * Counted apart from the delivery limits: fetching is the cheaper of the two, and failing at it
     * - a scan that went wrong, a viewer that was down - should not use up attempts at delivering.
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
                // The url is already the canonical one, so anywhere it points next is not FOD Justitie
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

        // A content type is only what the other end claims, so the bytes have to say it too
        if (bytes.subarray(0, 5).toString('latin1') !== '%PDF-') {
            throw this.notAPdf();
        }

        return bytes;
    }

    /** Stops at the cap rather than reading whole and measuring after: the other end decides how much it sends. */
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
     * One answer for every way this ends without a pdf in hand - a page instead of a document, a
     * response too large, no answer at all - because they are one thing to the member, and what to
     * do about it is the same each time. It also keeps what went wrong from being worth probing for.
     */
    private notAPdf(): SimpleError {
        return new SimpleError({
            code: 'judicial_record_not_available',
            message: 'FOD Justitie did not return a pdf',
            human: $t('We konden je uittreksel niet ophalen bij FOD Justitie. Probeer het over 20 minuten nog eens of upload het originele document.'),
            statusCode: 400,
        });
    }
}
