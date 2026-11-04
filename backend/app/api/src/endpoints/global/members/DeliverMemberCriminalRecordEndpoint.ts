import type { DecodedRequest, Request } from '@node/endpoints';
import { Endpoint, Response } from '@node/endpoints';
import { SimpleError } from '@common/errors';
import { checkCriminalRecordExtract, CRIMINAL_RECORD_MAX_FILE_SIZE } from '@stamhoofd/criminal-record-check/server/index.js';
import { Member, RateLimiter } from '@stamhoofd/models';
import type { CriminalRecordDeliveryResponse } from '@stamhoofd/structures';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';
import formidable from 'formidable';
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

        const { file, consent } = await this.parseForm(request);

        try {
            if (!consent) {
                throw new SimpleError({
                    code: 'missing_consent',
                    message: 'Consent is required to check an extract from the criminal register',
                    human: $t('Je moet toestemming geven om het uittreksel te laten controleren.'),
                    field: 'consent',
                    statusCode: 400,
                });
            }

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
     * Read the multipart body: the pdf in `file`, and the consent of the member in `consent`.
     *
     * The consent is validated and discarded, never stored: refusing the request without it is the
     * enforcement, and it is asked again on every delivery.
     */
    private async parseForm(request: DecodedRequest<Params, Query, Body>): Promise<{ file: formidable.File; consent: boolean }> {
        const incoming = request.request.request;

        if (!incoming) {
            throw new Error('Not supported without real request');
        }

        const form = formidable({ maxFileSize: CRIMINAL_RECORD_MAX_FILE_SIZE, maxFields: 2, keepExtensions: true });

        return await new Promise((resolve, reject) => {
            form.parse(incoming, (error, fields, files) => {
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

                resolve({ file, consent: fields.consent?.[0] === 'true' });
            });
        });
    }

    private formError(error: unknown): unknown {
        if (typeof error === 'object' && error !== null && 'httpCode' in error && error.httpCode === 413) {
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
