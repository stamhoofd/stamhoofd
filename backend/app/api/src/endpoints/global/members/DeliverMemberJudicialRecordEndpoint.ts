import { SimpleError } from '@common/errors';
import type { DecodedRequest, Request } from '@node/endpoints';
import { Endpoint, Response } from '@node/endpoints';
import { Member, RateLimiter } from '@stamhoofd/models';
import { JudicialRecordDeliveryResponse } from '@stamhoofd/structures';
import formidable, { errors as formidableErrors } from 'formidable';
import { promises as fs } from 'fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Context } from '../../../helpers/Context.js';
import { JudicialRecordService } from '../../../services/judicial-record/JudicialRecordService.js';

type Params = { id: string };
type Query = undefined;
type Body = undefined;
type ResponseBody = JudicialRecordDeliveryResponse;

/** A month, as the member is told when they request one. The member portal counts the same thirty days before it offers to deliver. */
export const JUDICIAL_RECORD_MAX_AGE_IN_DAYS = 30;

/** Only bounds what we are willing to read from the request: the verification has its own, smaller cap on the document it accepts. */
export const MAXIMUM_UPLOAD_SIZE = 5 * 1024 * 1024;

/** Checking a document parses a pdf and asks an authority about certificates, and a member needs only a handful of attempts. */
export const judicialRecordMemberLimiter = new RateLimiter({
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

/** One account delivers for its whole family, so its limit is the looser of the two. */
export const judicialRecordUserLimiter = new RateLimiter({
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
 * The final submit of the member portal delivery flow. The portal ran the same checks on the same
 * document a step earlier, but they run again here: that the frontend ran them is not something a
 * request can prove.
 */
export class DeliverMemberJudicialRecordEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/members/@id/judicial-record', { id: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await Context.setOptionalOrganizationScope();
        const { user } = await Context.authenticate();

        const member = await Member.getByIdWithUsers(request.params.id);

        // Not canAccessMember: an administrator reading someone else's extract needs a right of its
        // own, which arrives with the review flow that gives them something to read.
        if (!member || !Context.auth.isUserManager(member)) {
            throw Context.auth.memberNotFoundOrNoAccess();
        }

        this.trackLimits(user.id, member.id);

        // Allocated before parsing, so the artifacts a parser error leaves behind are inside the
        // directory the finally removes as a whole.
        const uploadDirectory = await fs.mkdtemp(join(tmpdir(), 'stamhoofd-judicial-record-'));

        try {
            const file = await this.parseForm(request, uploadDirectory);

            const status = await JudicialRecordService.deliver({
                member,
                data: await fs.readFile(file.filepath),
                maxAgeInDays: JUDICIAL_RECORD_MAX_AGE_IN_DAYS,
            });

            return new Response(JudicialRecordDeliveryResponse.create({ status }));
        } finally {
            await fs.rm(uploadDirectory, { recursive: true, force: true });
        }
    }

    private trackLimits(userId: string, memberId: string) {
        try {
            judicialRecordUserLimiter.track(userId, 1);
            judicialRecordMemberLimiter.track(memberId, 1);
        } catch (error) {
            throw new SimpleError({
                code: 'too_many_requests',
                message: 'Too many judicial record deliveries',
                human: $t('Je hebt te veel uittreksels opgeladen. Probeer het later opnieuw.'),
                statusCode: 429,
            });
        }
    }

    private async parseForm(request: DecodedRequest<Params, Query, Body>, uploadDirectory: string): Promise<formidable.File> {
        const incoming = request.request.request;

        if (!incoming) {
            throw new Error('Not supported without real request');
        }

        // Formidable has no parser for anything else and fails with an unhelpful stream error.
        if (!incoming.headers['content-type']?.startsWith('multipart/form-data')) {
            throw this.missingFile();
        }

        const form = formidable({ uploadDir: uploadDirectory, maxFileSize: MAXIMUM_UPLOAD_SIZE, maxFields: 0, maxFiles: 1, keepExtensions: true });

        return await new Promise((resolve, reject) => {
            form.parse(incoming, (error, _fields, files) => {
                if (error) {
                    reject(this.formError(error));
                    return;
                }

                const file = files.file?.[0];

                if (!file) {
                    reject(this.missingFile());
                    return;
                }

                resolve(file);
            });
        });
    }

    private missingFile(): SimpleError {
        return new SimpleError({
            code: 'missing_field',
            message: 'Missing file',
            human: $t('Kies het pdf-bestand van je uittreksel.'),
            field: 'file',
            statusCode: 400,
        });
    }

    /** Every way the body can fail to hold a document is the client's mistake, so none of them is a 500 - a full disk is ours and keeps its status. */
    private formError(error: unknown): unknown {
        const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : null;

        if (code === formidableErrors.biggerThanMaxFileSize || code === formidableErrors.biggerThanTotalMaxFileSize) {
            return new SimpleError({
                code: 'file_too_large',
                message: 'The uploaded file is too large',
                human: $t('Dit bestand is te groot. Laad het originele pdf-bestand op dat je van FOD Justitie kreeg.'),
                field: 'file',
                statusCode: 400,
            });
        }

        if (code === formidableErrors.missingMultipartBoundary || code === formidableErrors.malformedMultipart || code === formidableErrors.noEmptyFiles) {
            return this.missingFile();
        }

        return error;
    }
}
