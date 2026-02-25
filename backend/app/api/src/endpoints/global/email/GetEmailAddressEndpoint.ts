import { AutoEncoder, Decoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { EmailAddress } from '@stamhoofd/email';
import { Organization } from '@stamhoofd/models';
import { EmailAddressSettings, OrganizationSimple } from '@stamhoofd/structures';
import { Context } from '../../../helpers/Context.js';

type Params = Record<string, never>;
type Body = undefined;

class Query extends AutoEncoder {
    @field({ decoder: StringDecoder, nullable: true, optional: true })
    id: string | null = null;

    @field({ decoder: StringDecoder, nullable: true, optional: true })
    token: string | null = null;

    @field({ decoder: StringDecoder, nullable: true, optional: true })
    email: string | null = null;
}

type ResponseBody = EmailAddressSettings;

export class GetEmailAddressEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = Query as Decoder<Query>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/email/manage', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        if (request.query.id) {
            if (!request.query.token) {
                throw new SimpleError({
                    code: 'missing_field',
                    message: 'Missing token',
                    field: 'token',
                });
            }

            const email = await EmailAddress.getByID(request.query.id);
            if (!email || email.token !== request.query.token || request.query.token.length < 10 || request.query.id.length < 10) {
                throw new SimpleError({
                    code: 'invalid_fields',
                    message: 'Invalid token or id',
                    human: $t(`ceacb5a8-7777-4366-abcb-9dd90ffb832e`),
                });
            }

            const organization = email.organizationId ? (await Organization.getByID(email.organizationId)) : undefined;
            return new Response(EmailAddressSettings.create({
                ...email,
                organization: organization ? OrganizationSimple.create(organization) : null,
            }));
        }
        else {
            if (!request.query.email) {
                throw new SimpleError({
                    code: 'missing_field',
                    message: 'Missing email or id',
                    field: 'email',
                });
            }

            const organization = await Context.setOptionalOrganizationScope();
            await Context.authenticate();

            if (!Context.auth.hasPlatformFullAccess()) {
                throw Context.auth.error();
            }

            const query = EmailAddress.select().where(
                'email', request.query.email,
            );
            if (organization) {
                query.andWhere('organizationId', organization.id);
            }
            else {
                // No need
            }

            const emails = await query.fetch();

            if (emails.length === 0) {
                throw new SimpleError({
                    code: 'not_found',
                    message: 'Email not found',
                    human: $t(`9ddb6616-f62d-4c91-82a9-e5cf398e4c4a`),
                    statusCode: 404,
                });
            }

            return new Response(EmailAddressSettings.create({
                email: request.query.email,
                unsubscribedAll: !!emails.find(e => e.unsubscribedAll),
                unsubscribedMarketing: !!emails.find(e => e.unsubscribedMarketing),
                hardBounce: !!emails.find(e => e.hardBounce),
                markedAsSpam: !!emails.find(e => e.markedAsSpam),
                organization: organization ? OrganizationSimple.create(organization) : null,
            }));
        }
    }
}
