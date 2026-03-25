import type { Decoder} from '@simonbackx/simple-encoding';
import { AutoEncoder, BooleanDecoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import type { DecodedRequest, Request} from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Email, EmailAddress } from '@stamhoofd/email';
import { Context } from '../../../helpers/Context.js';
import { SESv2Client, DeleteSuppressedDestinationCommand } from '@aws-sdk/client-sesv2'; // ES Modules import
import { RateLimiter } from '@stamhoofd/models';
import { SQL } from '@stamhoofd/sql';

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

export const unblockLimiter = new RateLimiter({
    limits: [
        {
            // Max 10 per week
            limit: 10,
            duration: 24 * 60 * 1000 * 60 * 7,
        },
    ],
});

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
                    human: $t(`%DQ`),
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
            const { user } = await Context.authenticate();

            if (organization) {
                if (!await Context.auth.hasFullAccess(organization.id)) {
                    throw Context.auth.error();
                }
            }
            else {
                if (!Context.auth.hasPlatformFullAccess()) {
                    throw Context.auth.error();
                }
            }

            const emails = await EmailAddress.getByEmails([request.body.email], organization?.id ?? null);

            if (emails.length === 0) {
                throw new SimpleError({
                    code: 'not_found',
                    message: 'Email not found',
                    human: $t(`%DR`),
                    statusCode: 404,
                });
            }

            // Track limits
            for (const email of emails) {
                const wasBlocked = email.unsubscribedAll || email.unsubscribedMarketing || email.hardBounce || email.markedAsSpam;

                if (email.organizationId === null || (organization && email.organizationId === organization.id)) {
                    if (Context.auth.hasPlatformFullAccess()) {
                        // Only allowed as platform admins
                        email.unsubscribedAll = request.body.unsubscribedAll ?? email.unsubscribedAll;
                        email.unsubscribedMarketing = request.body.unsubscribedMarketing ?? email.unsubscribedMarketing;
                    }
                }

                email.hardBounce = request.body.hardBounce ?? email.hardBounce;
                email.markedAsSpam = request.body.markedAsSpam ?? email.markedAsSpam;

                const isBlocked = email.unsubscribedAll || email.unsubscribedMarketing || email.hardBounce || email.markedAsSpam;

                if (!isBlocked && wasBlocked && !Context.auth.hasPlatformFullAccess()) {
                    try {
                        unblockLimiter.track(organization?.id ?? '', 1);
                    }
                    catch (e) {
                        Email.sendWebmaster({
                            subject: '[Limiet] Limiet bereikt voor aantal unblocks',
                            text: 'Beste, \nDe limiet werd bereikt voor het aantal email unblocks per week. \nUser: ' + user.email + '\n\nVereniging: ' + (organization ? (organization.id + ' (' + organization.name + ')') : 'platform') + '\n\n' + e.message + '\n\nStamhoofd',
                        });

                        throw new SimpleError({
                            code: 'too_many_unblocks',
                            message: 'Too many unblocks',
                            human: $t(`%1L5`),
                        });
                    }
                }
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
                // Only save if all went well
                await email.save();
            }

            return new Response(undefined);
        }
    }
}
