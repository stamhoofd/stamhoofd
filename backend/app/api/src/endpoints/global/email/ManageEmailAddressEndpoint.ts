import { AutoEncoder, BooleanDecoder, Decoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { EmailAddress } from '@stamhoofd/email';
import { Context } from '../../../helpers/Context.js';
import { SESv2Client, DeleteSuppressedDestinationCommand } from '@aws-sdk/client-sesv2'; // ES Modules import

type Params = Record<string, never>;
type Query = undefined;

class Body extends AutoEncoder {
    @field({ decoder: StringDecoder, nullable: true, optional: true })
    id: string | null = null;

    @field({ decoder: StringDecoder, nullable: true, optional: true })
    token: string | null = null;

    @field({ decoder: StringDecoder, nullable: true, optional: true })
    email: string | null = null;

    @field({ decoder: BooleanDecoder, optional: true })
    unsubscribedMarketing?: boolean;

    @field({ decoder: BooleanDecoder, optional: true })
    unsubscribedAll?: boolean;

    /**
     * Set to false to unblock
     */
    @field({ decoder: BooleanDecoder, optional: true })
    hardBounce?: boolean;

    /**
     * Set to false to unblock
     */
    @field({ decoder: BooleanDecoder, optional: true })
    markedAsSpam?: boolean;
}

type ResponseBody = undefined;

export class ManageEmailAddressEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = Body as Decoder<Body>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/email/manage', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        if (request.body.id) {
            if (!request.body.token) {
                throw new SimpleError({
                    code: 'missing_field',
                    message: 'Missing token',
                    field: 'token',
                });
            }
            const email = await EmailAddress.getByID(request.body.id);
            if (!email || email.token !== request.body.token || request.body.token.length < 10 || request.body.id.length < 10) {
                throw new SimpleError({
                    code: 'invalid_fields',
                    message: 'Invalid token or id',
                    human: $t(`ceacb5a8-7777-4366-abcb-9dd90ffb832e`),
                });
            }

            email.unsubscribedAll = request.body.unsubscribedAll ?? email.unsubscribedAll;
            email.unsubscribedMarketing = request.body.unsubscribedMarketing ?? email.unsubscribedMarketing;

            await email.save();
            return new Response(undefined);
        }
        else {
            if (!request.body.email) {
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
                'email', request.body.email,
            );
            if (organization) {
                query.andWhere('organizationId', organization.id);
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
            console.log('Updated email address settings', request.body);
            const client = new SESv2Client({});

            if (request.body.hardBounce === false || request.body.markedAsSpam === false) {
                // Remove from AWS suppression list
                // todo
                try {
                    const input = {
                        EmailAddress: request.body.email,
                    };
                    const command = new DeleteSuppressedDestinationCommand(input);
                    const response = await client.send(command);
                    console.log('Removed from AWS suppression list', request.body.email, response);
                }
                catch (error) {
                    console.error('Error removing from suppression list', request.body.email, error);
                }
            }

            for (const email of emails) {
                email.unsubscribedAll = request.body.unsubscribedAll ?? email.unsubscribedAll;
                email.unsubscribedMarketing = request.body.unsubscribedMarketing ?? email.unsubscribedMarketing;
                email.hardBounce = request.body.hardBounce ?? email.hardBounce;
                email.markedAsSpam = request.body.markedAsSpam ?? email.markedAsSpam;
                await email.save();
            }

            return new Response(undefined);
        }
    }
}
