import { SimpleError } from '@common/errors';
import type { DecodedRequest, Request } from '@node/endpoints';
import { Endpoint, Response } from '@node/endpoints';
import { Member, RateLimiter } from '@stamhoofd/models';
import { JudicialRecordDeliveryResponse } from '@stamhoofd/structures';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';
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

/** Only bounds what we are willing to read from the request: the verification has its own, smaller cap on the document it accepts. */
export const MAXIMUM_UPLOAD_SIZE = 5 * 1024 * 1024;

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

        const member = await Member.getByIdWithUsersAndRegistrations(request.params.id);

        // The member's own account, or an administrator with full access to them: the level the member
        // detail already asks for the member's security code, which is the same kind of secret.
        if (!member || !(Context.auth.isUserManager(member) || await Context.auth.canAccessMember(member, PermissionLevel.Full))) {
            throw Context.auth.memberNotFoundOrNoAccess();
        }

        this.trackLimits(user.id, member.id);

        // Allocated before parsing, so the artifacts a parser error leaves behind are inside the
        // directory the finally removes as a whole.
        const uploadDirectory = await fs.mkdtemp(join(tmpdir(), 'stamhoofd-judicial-record-'));

        try {
            const file = await this.parseForm(request, uploadDirectory);

            const status = await JudicialRecordService.deliver(member, await fs.readFile(file.filepath));

            return new Response(JudicialRecordDeliveryResponse.create({ status }));
        } finally {
            await fs.rm(uploadDirectory, { recursive: true, force: true });
        }
    }

    private trackLimits(userId: string, memberId: string) {
        // Narrowest limit first: a delivery the member's own limit already refuses must not spend
        // the budget of the account, which is shared with its other members.
        try {
            judicialRecordMemberLimiter.track(memberId, 1);
            judicialRecordUserLimiter.track(userId, 1);
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
