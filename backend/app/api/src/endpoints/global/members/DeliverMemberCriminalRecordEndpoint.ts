import type { DecodedRequest, Request } from '@node/endpoints';
import { Endpoint, Response } from '@node/endpoints';
import { SimpleError } from '@common/errors';
import { checkCriminalRecordExtract, CRIMINAL_RECORD_MAX_FILE_SIZE } from '@stamhoofd/criminal-record-check/server/index.js';
import { Member, RateLimiter } from '@stamhoofd/models';
import type { CriminalRecordDeliveryResponse } from '@stamhoofd/structures';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';
import formidable, { errors as formidableErrors } from 'formidable';
import { promises as fs } from 'fs';
import { Context } from '../../../helpers/Context.js';

type Params = { id: string };
type Query = undefined;
type Body = undefined;
type ResponseBody = CriminalRecordDeliveryResponse;

/**
 * Checking a document is expensive, and a member needs only a handful of attempts.
 */
export const criminalRecordMemberLimiter = new RateLimiter({
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

/**
 * A user manager can deliver for every member of their family, an administrator for every member
 * they have access to.
 */
export const criminalRecordUserLimiter = new RateLimiter({
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
 * Deliver an extract from the criminal register for a member: the signature of FOD Justitie is
 * verified and the document is read and checked while the request runs, so the result is returned
 * right away. No background task, no polling.
 *
 * The document itself is not stored: it is read, checked and removed again. Storing it for a
 * reviewer comes with the review flow.
 */
export class DeliverMemberCriminalRecordEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/members/@id/criminal-record', { id: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await Context.setOptionalOrganizationScope();
        const { user } = await Context.authenticate();

        const member = await Member.getWithRegistrations(request.params.id);

        // Note: whether an extract is required for this member, and the separate read right an
        // administrator needs for it, arrive with the status on the member.
        if (!member || !await Context.auth.canAccessMember(member, PermissionLevel.Write)) {
            throw Context.auth.memberNotFoundOrNoAccess();
        }

        this.trackLimits(user.id, member.id);

        const file = await this.parseForm(request);

        try {
            const data = await fs.readFile(file.filepath);

            return new Response(await checkCriminalRecordExtract({
                data,
                member: {
                    firstName: member.details.firstName,
                    lastName: member.details.lastName,
                    birthDay: member.details.birthDay,
                },
                deliveredAt: new Date(),
            }));
        } finally {
            // The document is never kept: formidable wrote the upload to a temporary file
            await fs.rm(file.filepath, { force: true }).catch(() => { /* we can't do anything about this */ });
        }
    }

    private trackLimits(userId: string, memberId: string) {
        try {
            criminalRecordUserLimiter.track(userId, 1);
            criminalRecordMemberLimiter.track(memberId, 1);
        } catch (e) {
            throw new SimpleError({
                code: 'too_many_requests',
                message: 'Too many criminal record checks',
                human: $t('Je hebt te veel pogingen gedaan. Probeer het later opnieuw.'),
                statusCode: 429,
            });
        }
    }

    /**
     * Read the multipart body: the pdf in `file`.
     */
    private async parseForm(request: DecodedRequest<Params, Query, Body>): Promise<formidable.File> {
        const incoming = request.request.request;

        if (!incoming) {
            throw new Error('Not supported without real request');
        }

        // Only the pdf: a document is checked, nothing else is read from the body
        const form = formidable({ maxFileSize: CRIMINAL_RECORD_MAX_FILE_SIZE, maxFields: 0, maxFiles: 1, keepExtensions: true });

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
                        field: 'file',
                        statusCode: 400,
                    }));
                    return;
                }

                resolve(file);
            });
        });
    }

    private formError(error: unknown): unknown {
        const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : null;

        if (code === formidableErrors.biggerThanMaxFileSize || code === formidableErrors.biggerThanTotalMaxFileSize) {
            return new SimpleError({
                code: 'file_too_large',
                message: 'The uploaded file is too large',
                human: $t('Dit bestand is te groot. Laad de originele pdf van FOD Justitie op.'),
                field: 'file',
                statusCode: 400,
            });
        }

        return error;
    }
}
