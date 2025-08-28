import { Decoder, encodeObject } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { I18n } from '@stamhoofd/backend-i18n';
import { Email } from '@stamhoofd/email';
import { SGVReportIssue, Version } from "@stamhoofd/structures";

import { Context } from '../../../../helpers/Context';
type Params = Record<string, never>;
type Query = undefined;
type Body = SGVReportIssue
type ResponseBody = undefined

let lastReportedIssue = new Date(0)

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

        if (lastReportedIssue.getTime() < new Date().getTime() - 1000 * 60 * 60 * 6) {
            // Send an email once every 6 hours to notify about new issues
            lastReportedIssue = new Date()
            Email.sendInternal({
                to: "hallo@stamhoofd.be",
                subject: "Probleem met synchronisatie groepsadministratie gedetecteerd",
                text: "Hieronder de details van het probleem\n\n" + 'Organization: ' + organization.name + ' (' + organization.id + ')\n' + 'User: ' + user.id + ' (' + user.email + ')\n' + 'Method: ' + request.body.method + '\nPath: ' + request.body.path + '\nTimestamp: ' + new Date().toISOString() +'\n\nStamhoofd',
                type: "transactional"
            }, new I18n("nl", "BE"))
        }

        //todo
        return new Response(undefined)
    }
}
