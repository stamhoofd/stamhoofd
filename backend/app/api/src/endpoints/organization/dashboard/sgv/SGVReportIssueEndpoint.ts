import { Decoder, encodeObject } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SGVReportIssue, Version } from "@stamhoofd/structures";

import { Context } from '../../../../helpers/Context';
type Params = Record<string, never>;
type Query = undefined;
type Body = SGVReportIssue
type ResponseBody = undefined

export class SGVReportIssueEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = SGVReportIssue as Decoder<SGVReportIssue>

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "POST") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/sgv/report-issue", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        const {user} = await Context.authenticate()

        // Fast throw first (more in depth checking for patches later)
        if (!Context.auth.hasFullAccess()) {
            throw Context.auth.error()
        }

        console.log(
            '[NEW SGV ISSUE]\n', 
            'Organization:', organization.name, organization.id, '\n',
            'User:', user.id, user.email, '\n',
            'Issue:\n',
            JSON.stringify(encodeObject(request.body, {version: Version}),null, 2)
        )

        //todo
        return new Response(undefined)
    }
}
