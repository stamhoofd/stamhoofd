import { AutoEncoderPatchType,Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { Token } from '@stamhoofd/models';
import { Webshop } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import { PermissionLevel, PrivateWebshop, WebshopPrivateMetaData } from "@stamhoofd/structures";
import { Formatter } from '@stamhoofd/utility';

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
        const token = await Token.authenticate(request);
        const user = token.user

        if (!user.permissions) {
            throw new SimpleError({
                code: "permission_denied",
                message: "You do not have permissions for this endpoint",
                statusCode: 403
            })
        }

        return await QueueHandler.schedule("webshop-stock/"+request.params.id, async () => {
            // Halt all order placement and validation + pause stock updates
            const webshop = await Webshop.getByID(request.params.id)
            if (!webshop || webshop.organizationId != user.organizationId) {
                throw new SimpleError({
                    code: "not_found",
                    message: "Webshop not found",
                    human: "De webshop die je wilt aanpassen bestaat niet (meer)"
                })
            }

            if (webshop.privateMeta.permissions.getPermissionLevel(user.permissions!) !== PermissionLevel.Full) {
                throw new SimpleError({
                    code: "permission_denied",
                    message: "You do not have permissions for this endpoint",
                    statusCode: 403
                })
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
