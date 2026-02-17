import { ArrayDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { EmailAddress } from '@stamhoofd/email';
import { EmailInformation } from '@stamhoofd/structures';

import { Context } from '../../../../helpers/Context.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = string[];
type ResponseBody = EmailInformation[];

export class CheckEmailBouncesEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = new ArrayDecoder(StringDecoder);

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/email/check-bounces', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOptionalOrganizationScope();
        await Context.authenticate();

        // null if platform
        const organizationId: string | null = organization ? organization.id : null;

        if (!await Context.auth.canAccessEmailBounces(organizationId)) {
            throw Context.auth.error();
        }

        if (request.body.length > 10000) {
            throw new SimpleError({
                code: 'too_many_recipients',
                message: 'Too many recipients',
                human: $t(`0a406ba7-037a-405b-93f8-de308a66f3e3`),
                field: 'recipients',
            });
        }

        const emails = await EmailAddress.getByEmails(request.body, organizationId);

        // Remove duplicates + remove emails where all values are false
        const cleaned: EmailInformation[] = [];
        for (const email of emails) {
            const c = EmailInformation.create(email);
            const existing = cleaned.find(cc => cc.email === email.email);
            if (existing) {
                existing.markedAsSpam = existing.markedAsSpam || c.markedAsSpam;
                existing.hardBounce = existing.hardBounce || c.hardBounce;

                if (email.organizationId === null && organizationId === null) {
                    // Only show unsubscribe status of platform
                    existing.unsubscribedAll = c.unsubscribedAll;
                    existing.unsubscribedMarketing = c.unsubscribedMarketing;
                }
                continue;
            }

            if (email.organizationId !== null && organizationId === null) {
                // Only show unsubscribe status of platform
                c.unsubscribedAll = false;
                c.unsubscribedMarketing = false;
            }

            cleaned.push(c);
        }

        // We don't return empty ones to increase privacy a bit - admins should not know what email addresses are in the system unless they have bounced
        return new Response(cleaned.filter(c => c.markedAsSpam || c.hardBounce || c.unsubscribedAll || c.unsubscribedMarketing));
    }
}
