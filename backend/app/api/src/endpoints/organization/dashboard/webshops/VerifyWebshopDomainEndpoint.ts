import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from '@simonbackx/simple-errors';
import { Token, Webshop } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import { PermissionLevel, PrivateWebshop, WebshopPrivateMetaData } from "@stamhoofd/structures";

import { Context } from "../../../../helpers/Context";

type Params = { id: string };
type Query = undefined;
type Body = undefined;
type ResponseBody = PrivateWebshop;

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class VerifyWebshopDomainEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "POST") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/webshop/@id/verify-domain", { id: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        await Context.authenticate()

        // Fast throw first (more in depth checking for patches later)
        if (!await Context.auth.hasSomeAccess(organization.id)) {
            throw Context.auth.error()
        }

        return await QueueHandler.schedule("webshop-stock/"+request.params.id, async () => {
            const webshop = await Webshop.getByID(request.params.id)
            if (!webshop || !await Context.auth.canAccessWebshop(webshop, PermissionLevel.Full)) {
                throw Context.auth.notFoundOrNoAccess()
            }
        
            if (webshop.domain !== null) {
                webshop.privateMeta.dnsRecords = WebshopPrivateMetaData.buildDNSRecords(webshop.domain)
                await webshop.updateDNSRecords()
            } else {
                webshop.privateMeta.dnsRecords = []
                webshop.meta.domainActive = false
            }

            await webshop.save()
            return new Response(PrivateWebshop.create(webshop));
        });
    }
}
