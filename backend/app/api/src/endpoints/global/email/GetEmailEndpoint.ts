import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { Email } from '@stamhoofd/models';
import { EmailPreview } from '@stamhoofd/structures';

import { SimpleError } from '@simonbackx/simple-errors';
import { Context } from '../../../helpers/Context.js';

type Params = { id: string };
type Query = undefined;
type Body = undefined;
type ResponseBody = EmailPreview;

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class GetEmailEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/email/@id', { id: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOptionalOrganizationScope();
        await Context.authenticate();

        if (!await Context.auth.canReadEmails(organization)) {
            throw Context.auth.error();
        }

        const model = await Email.getByID(request.params.id);
        if (!model || (model.organizationId !== (organization?.id ?? null))) {
            throw new SimpleError({
                code: 'not_found',
                message: 'Email not found',
                human: $t(`9ddb6616-f62d-4c91-82a9-e5cf398e4c4a`),
                statusCode: 404,
            });
        }

        if (!await Context.auth.canAccessEmail(model)) {
            throw Context.auth.error();
        }

        return new Response(await model.getPreviewStructure());
    }
}
