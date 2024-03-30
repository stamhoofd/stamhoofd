import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from '@simonbackx/simple-errors';
import { Token } from '@stamhoofd/models';
import { OpenIDClientConfiguration } from "@stamhoofd/structures";

type Params = Record<string, never>;
type Query = undefined;
type Body = undefined;
type ResponseBody = OpenIDClientConfiguration

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class GetOrganizationSSOEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/organization/sso", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const token = await Token.authenticate(request);
        const user = token.user

        if (!user.hasFullAccess()) {
            throw new SimpleError({
                code: "permission_denied",
                message: "You do not have permissions for this endpoint",
                statusCode: 403
            })
        }

        const organization = user.organization
        return new Response(organization.serverMeta.ssoConfiguration ?? OpenIDClientConfiguration.create({
            clientId: "",
            clientSecret: "",
            issuer: ""
        }));
    }
}
