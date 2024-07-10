import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { Email } from '@stamhoofd/models';
import { EmailPreview } from "@stamhoofd/structures";

import { SimpleError } from '@simonbackx/simple-errors';
import { Context } from '../../../helpers/Context';

type Params = {id: string};
type Query = undefined;
type Body = undefined
type ResponseBody = EmailPreview;

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class GetEmailEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/email/@id", {id: String});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOptionalOrganizationScope();
        const {user} = await Context.authenticate()

        if (!Context.auth.canSendEmails()) {
            throw Context.auth.error()
        }  

        const model = await Email.getByID(request.params.id);
        if (!model || model.userId !== user.id || (model.organizationId !== (organization?.id ?? null))) {
            throw new SimpleError({
                code: "not_found",
                human: "Email not found",
                message: 'Deze e-mail bestaat niet of is verwijderd',
                statusCode: 404
            })
        }

        return new Response(await model.getPreviewStructure());
    }
}
