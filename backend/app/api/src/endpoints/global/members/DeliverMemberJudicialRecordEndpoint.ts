import { SimpleError } from '@common/errors';
import type { DecodedRequest, Request } from '@node/endpoints';
import { Endpoint, Response } from '@node/endpoints';
import { Member, RateLimiter } from '@stamhoofd/models';
import { JudicialRecordCheckReport } from '@stamhoofd/structures';
import formidable, { errors as formidableErrors } from 'formidable';
import { promises as fs } from 'fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Context } from '../../../helpers/Context.js';
import { JudicialRecordService } from '../../../services/judicial-record/JudicialRecordService.js';

type Params = { id: string };
type Query = undefined;
type Body = undefined;
type ResponseBody = JudicialRecordCheckReport;

/**
 * How old an extract may be when it is delivered. A month, as the member is told when they request
 * one, counted from the day it was drawn up.
 */
export const JUDICIAL_RECORD_MAX_AGE_IN_DAYS = 31;

/**
 * Only bounds what we are willing to read from the request: the verification has its own, smaller
 * cap on the document it accepts.
 */
export const MAXIMUM_UPLOAD_SIZE = 5 * 1024 * 1024;

/**
 * Checking a document is expensive - it parses a pdf and asks an authority about certificates - and
 * a member needs only a handful of attempts to deliver one.
 */
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
 * Delivering an extract from the judicial record for a member: the pdf goes in, the result of the
 * five automatic checks comes out. Everything happens inside the request, so whoever uploaded it
 * sees right away which checks held and which did not.
 *
 * Nothing is stored. Not the document - it is read, checked and removed again, also when the
 * request fails - and not the outcome: keeping either of those for a reviewer arrives with the
 * review flow. So this endpoint decides nothing about the member, which is why delivering is
 * allowed to the member themselves and their parents and to nobody else for now. An administrator
 * reading someone else's extract needs a right of its own, and that right belongs with the review
 * flow that gives them something to read.
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

        // Only the member and their parents, never an administrator: see the note on the class.
        if (!member || !Context.auth.isUserManager(member)) {
            throw Context.auth.memberNotFoundOrNoAccess();
        }

        this.trackLimits(user.id, member.id);

        // Allocate before parsing, so every temporary artifact of this request belongs to a
        // directory we remove as a whole - also the ones a parser error leaves behind.
        const uploadDirectory = await fs.mkdtemp(join(tmpdir(), 'stamhoofd-judicial-record-'));

        try {
            const file = await this.parseForm(request, uploadDirectory);

            return new Response(await JudicialRecordService.check({
                data: await fs.readFile(file.filepath),
                firstName: member.details.firstName,
                lastName: member.details.lastName,
                birthDay: member.details.birthDay,
                maxAgeInDays: JUDICIAL_RECORD_MAX_AGE_IN_DAYS,
            }));
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

    /** The body holds the pdf and nothing else: no field of it is read. */
    private async parseForm(request: DecodedRequest<Params, Query, Body>, uploadDirectory: string): Promise<formidable.File> {
        const incoming = request.request.request;

        if (!incoming) {
            throw new Error('Not supported without real request');
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
                    reject(new SimpleError({
                        code: 'missing_field',
                        message: 'Missing file',
                        human: $t('Kies het pdf-bestand van je uittreksel.'),
                        field: 'file',
                        statusCode: 400,
                    }));
                    return;
                }

                resolve(file);
            });
        });
    }

    /**
     * A file too large is the one parser error worth its own message: it is the member's to fix, and
     * the fix is to upload the original pdf rather than a scan or a photo of it.
     */
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

        return error;
    }
}
