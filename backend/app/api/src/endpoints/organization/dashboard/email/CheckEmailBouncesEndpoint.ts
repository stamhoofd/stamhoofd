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

        if (organization) {
            if (!await Context.auth.canAccessEmailBounces(organization.id)) {
                throw Context.auth.error();
            }
        }
        else {
            if (!Context.auth.hasPlatformFullAccess()) {
                throw Context.auth.error();
            }
        }

        if (request.body.length > 10000) {
            throw new SimpleError({
                code: 'too_many_recipients',
                message: 'Too many recipients',
                human: $t(`0a406ba7-037a-405b-93f8-de308a66f3e3`),
                field: 'recipients',
            });
        }

        const emails = await EmailAddress.getByEmails(request.body, organization ? organization.id : null);
        return new Response(emails.map(e => EmailInformation.create(e)));
    }
}
