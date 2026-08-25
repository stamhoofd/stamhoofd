import type { Decoder } from '@simonbackx/simple-encoding';
import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import type { Organization, User } from '@stamhoofd/models';
import { RateLimiter, User as UserModel } from '@stamhoofd/models';
import { File } from '@stamhoofd/structures';

import { Context } from '../../../helpers/Context.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = File;
type ResponseBody = File;

export const limiter = new RateLimiter({
    limits: [
        {
            // Max 500 per hour
            limit: 500,
            duration: 60 * 1000 * 60,
        },
    ],
});

type FileOwner = { type: 'anonymous'; organizationId: string } | { type: 'user'; userId: string };

/**
 * A private file is stored under the user that uploaded it, or under the organization it was uploaded for when
 * there was no user (see UploadFile), so this reads who a file belongs to from its path.
 *
 * Only the last part of a path is chosen by the uploader (the slug of the filename), which is why a segment has
 * to follow the id before we read it as an owner.
 */
function getFileOwner(path: string): FileOwner | null {
    const match = /(?:^|\/)(anonymous|users)\/([^/]+)\/[^/]+\//.exec(path);

    if (!match) {
        return null;
    }

    return match[1] === 'anonymous'
        ? { type: 'anonymous', organizationId: match[2] }
        : { type: 'user', userId: match[2] };
}

/**
 * Returns a file with a fresh signed url, so a client can keep opening a private file after the signed url it
 * received earlier expired.
 *
 * A valid signature only proves the file was handed out by us, so it is never enough on its own: the caller
 * also has to be the user that uploaded the file, or an administrator that manages the uploader or the
 * organization the file was uploaded for.
 */
export class GetSignedFileUrlEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = File as Decoder<File>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/file-signed-url', {});

        if (params) {
            return [true, params as Params];
        }

        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        // The organization is optional: the admin app is not scoped to one
        const organization = await Context.setOptionalOrganizationScope();
        const { user } = await Context.authenticate();

        if (organization && !await Context.auth.hasSomeAccess(organization.id)) {
            throw Context.auth.error();
        }

        limiter.track(user.id, 1);

        const file = request.body;

        // Whatever url the client sent, it is replaced with one we generate ourselves
        file.signedUrl = null;

        if (!file.isPrivate) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'A public file does not need a signed url',
                human: $t('Dit bestand is publiek toegankelijk.'),
                field: 'isPrivate',
                statusCode: 400,
            });
        }

        // The request middleware already refuses files with an invalid signature, but this endpoint hands out
        // access to a file, so it never relies on that check alone
        if (!await file.verify()) {
            throw new SimpleError({
                code: 'invalid_signature',
                message: 'Invalid signature for file',
                human: $t('Je hebt geen toegang tot dit bestand.'),
                statusCode: 400,
            });
        }

        const owner = getFileOwner(file.path);

        if (!owner) {
            throw new SimpleError({
                code: 'not_supported',
                message: 'Not supported file',
                human: $t('Je hebt geen toegang tot dit bestand.'),
                statusCode: 400,
            });
        }

        // The signature of a file ends up with everyone who receives the object it is attached to, so it can
        // never be the only thing that grants access here
        if (!await this.canAccess(owner, organization, user)) {
            throw Context.auth.error();
        }

        // The signed url itself is added by FileSignService when the response is sent
        return new Response(file);
    }

    private async canAccess(owner: FileOwner, organization: Organization | null, user: User): Promise<boolean> {
        if (owner.type === 'anonymous') {
            return !!organization && owner.organizationId === organization.id;
        }

        if (owner.userId === user.id) {
            return true;
        }

        const uploader = await UserModel.getByID(owner.userId);

        if (!uploader) {
            return false;
        }

        return await Context.auth.canDownloadFileOfUser(uploader);
    }
}
